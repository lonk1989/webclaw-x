/**
 * @lonk1989/webclaw — recipe-level browser RPA for DeepSeek Harness.
 *
 * Registers task tools that spawn webclaw-lite. Does not claim ctx.browserUse.
 * On Windows / macOS, ensureOnBoot (default true) downloads lite from GitHub Releases.
 * @module
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import {
  ensureLite,
  resolveBinaryPath,
  resolveLiteBaseUrl,
  resolveWebclawHome,
  type EnsureLiteResult,
} from './ensure-lite.js'
import {
  cancelActiveHitl,
  hasActiveHitl,
  parseDoneEvent,
  resumeActiveHitl,
  runLite,
  writeCancelMarker,
  writeTempRecipe,
  type LiteEnv,
  type SpawnResult,
} from './spawn.js'
import {
  agentCwd,
  agentSessionId,
  freezeRecipe,
  importRecipe,
  listRecipes,
  resolveRecipePath,
  type RecipesConfig,
} from './recipes.js'
import { promoteRunDeliverables } from './promote-outputs.js'
import { rememberAssembledModel, resolveVisionCapability } from './model-vision.js'
import {
  applyParamOverrides,
  collectConfirmableParams,
  extractRecipeParams,
  parseParamsArg,
  type RecipeParamKv,
} from './params.js'
import { redactSecrets } from './redact.js'
import { sanitizeWebclawRecipe } from './url-coerce.js'
import {
  ACCOUNTS_UI_DEFAULT_PORT,
  startAccountsUiServer,
  type AccountsUiHandle,
} from './accounts-ui-server.js'
import {
  CREDENTIALS_SETUP_HINT,
  ensureAccount,
  isSsoAccountUrl,
  listAccounts,
  missingCredentialsForRecipe,
  normalizeSystemUrl,
  patchSystemsFile,
  setAccount,
} from './accounts-vault.js'
import { registerBundledSkill } from './skill.js'
import { clearLiveFocus, publishLiveFocus } from './live-focus.js'

/** Cordis plugin id. */
export const name = 'webclaw'

/** Tool registry must exist; skills are optional (deferred via ctx.inject). */
export const inject = ['tools']

/** Deploy-time options for locating and invoking webclaw-lite. */
export interface Config {
  /**
   * Absolute path to webclaw-lite, or empty / `webclaw-lite` to use the managed
   * binary (auto-downloaded on Windows / macOS from GitHub Releases).
   * Windows: `%LOCALAPPDATA%/webclaw/bin/webclaw-lite.exe`
   * macOS: `~/.webclaw/bin/webclaw-lite`
   */
  binaryPath: string
  /** Maps to WEBCLAW_HOME. */
  webclawHome: string
  /**
   * Release directory prefix for download/update (no filename).
   * Empty → GitHub `…/releases/download/v{pluginVersion}`.
   */
  liteBaseUrl: string
  /** When true, ensure lite at boot (download if missing). Default true. */
  ensureOnBoot: boolean
  /** Register packaged SKILL.md. Default true. */
  registerSkill: boolean
  /** Max ms for a single `webclaw_run` (default 10 minutes). */
  runTimeoutMs: number
  /** Max ms for `webclaw_probe` (default 2 minutes). */
  probeTimeoutMs: number
  /**
   * Absolute recipes library directory. When set, wins over workspace-relative.
   * Empty: use `{agent.cwd}/{recipesRel}` or `WEBCLAW_HOME/recipes`.
   */
  recipesDir: string
  /** Relative recipes folder under session cwd (default `recipes`). */
  recipesRel: string
  /**
   * When true (default), recipes that declare `参数名=值` refuse to run until
   * the model shows the param form and calls again with `paramsConfirmed=true`.
   */
  requireParamConfirm: boolean
  /**
   * Private deploy overlay: seed local vault entries (id + name + login URL).
   * Optional username/password for private test accounts — applied via
   * `accounts set` (DPAPI) after lite is ready. Not for public OSS defaults.
   */
  systems: SystemEntryConfig[]
  /**
   * Start loopback accounts UI (127.0.0.1) for Settings form / browser page.
   * Default true. Passwords never enter the LLM.
   */
  accountsUi: boolean
  /** Preferred loopback port for accounts UI (default 19229). */
  accountsUiPort: number
}

/** One site entry for `config.systems` (private fork may include test credentials). */
export interface SystemEntryConfig {
  id: string
  name?: string
  url: string
  /** Optional — private deploy test account only. */
  username?: string
  /** Optional — private deploy test account only; never logged / never to LLM. */
  password?: string
}

/** Validate plugin config from cordis.yml. */
export const Config: z<Partial<Config>, Config> = z.object({
  binaryPath: z.string().default('webclaw-lite'),
  webclawHome: z.string().default(''),
  liteBaseUrl: z.string().default(''),
  ensureOnBoot: z.boolean().default(true),
  registerSkill: z.boolean().default(true),
  runTimeoutMs: z.number().min(1_000).default(600_000),
  probeTimeoutMs: z.number().min(1_000).default(120_000),
  recipesDir: z.string().default(''),
  recipesRel: z.string().default('recipes'),
  requireParamConfirm: z.boolean().default(true),
  systems: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(''),
        url: z.string(),
        username: z.string().default(''),
        password: z.string().default(''),
      }),
    )
    .default([]),
  accountsUi: z.boolean().default(true),
  accountsUiPort: z.number().min(1).max(65_535).default(ACCOUNTS_UI_DEFAULT_PORT),
})

/**
 * Prefill local vault site entries from deploy config (url + optional credentials).
 */
async function ensureConfiguredSystems(
  config: Config,
  ensured: EnsureLiteResult,
  log: { info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void },
): Promise<void> {
  const entries = config.systems ?? []
  if (entries.length === 0) {
    log.warn('webclaw: config.systems empty — vault overlay not applied')
    return
  }
  const env = liteEnvFrom(config, ensured, 60_000)
  const home = env.webclawHome?.trim() || ensured.webclawHome
  const normalized = entries
    .map(e => ({
      id: e.id?.trim() ?? '',
      name: e.name?.trim(),
      url: normalizeSystemUrl(e.url ?? ''),
      username: e.username?.trim() || '',
      password: e.password ?? '',
    }))
    .filter(e => e.id && e.url)

  // 1) Direct file write — reliable for `&` in URLs (no CLI/YAML truncation).
  try {
    const patched = patchSystemsFile(
      home,
      normalized.map(e => ({
        id: e.id,
        url: e.url,
        name: e.name,
        username: e.username || undefined,
      })),
    )
    log.info(
      'webclaw: systems file patched %s → %s',
      patched.path,
      patched.updated.join('; ') || '(none)',
    )
  } catch (error) {
    log.warn(
      'webclaw: systems file patch failed: %s',
      error instanceof Error ? error.message : error,
    )
  }

  // 2) URL ensure + optional credential set (encrypted by lite).
  for (const entry of normalized) {
    try {
      const result = await ensureAccount(env, {
        id: entry.id,
        url: entry.url,
        name: entry.name,
      })
      if (!result.ok) {
        log.warn('webclaw: accounts ensure failed id=%s: %s', entry.id, result.error)
        continue
      }
      log.info('webclaw: accounts ensure ok id=%s url=%s', entry.id, entry.url)
      if (entry.username && entry.password) {
        const set = await setAccount(env, {
          id: entry.id,
          user: entry.username,
          password: entry.password,
          url: entry.url,
          name: entry.name,
        })
        if (!set.ok) {
          log.warn('webclaw: accounts set failed id=%s: %s', entry.id, set.error)
        } else {
          log.info('webclaw: accounts set ok id=%s user=%s', entry.id, entry.username)
        }
      }
    } catch (error) {
      log.warn(
        'webclaw: accounts ensure error id=%s: %s',
        entry.id,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

function formatParamForm(params: readonly RecipeParamKv[]): string {
  const rows = params.map(p => {
    // Strip accidental verb glue from older clients (家中有事登录EHR系统).
    let value = p.value || '（空）'
    value = value.replace(/登录[\u4e00-\u9fffA-Za-z0-9_-]*$/u, '').trim() || value
    return `- ${p.name}：${value}`
  })
  return [
    '【运行前请先确认参数 — 下列是默认值，请用户快捷改完再跑】',
    '',
    '立刻把下表展示给用户（可编辑表 / 整表贴回均可），等他们确认或改完。',
    '不要静默用默认值开跑；不要跳过确认；不要逐项口头追问。',
    ...rows,
    '',
    '用户改完或明确说「用默认」后：再次 webclaw_run，paramsConfirmed=true，并传 params 对象（不要传 JSON 字符串），如 {"公司":"山西阳泉","月份":"2026-07"}。',
    '确认前禁止 paramsConfirmed=true。',
  ].join('\n')
}

/**
 * Prefer Host native ask-user UI so params are confirmed before the browser starts.
 * Each field offers the current default as a one-tap option; custom text overrides.
 * Skip / empty answers keep the offered default — never wipe to blank.
 */
async function confirmRecipeParamsWithUser(
  params: readonly RecipeParamKv[],
  exec: { signal?: AbortSignal; agent?: unknown },
): Promise<RecipeParamKv[] | 'cancelled'> {
  if (!askUserQuestions || params.length === 0) {
    return [...params]
  }
  const answered = await askUserQuestions({
    questions: params.map(p => {
      const def = (p.value || '').trim()
      const shown = def || '（空）'
      return {
        id: `webclaw-param:${p.name}`,
        header: '确认运行参数',
        question: p.name,
        detail: `默认值：${shown}。点选默认即可，或输入新值后确认。跳过=沿用默认（不会清空）。`,
        options: [{ label: shown, description: def ? '使用默认值' : '保持为空' }],
      }
    }),
    agent: exec.agent,
    signal: exec.signal,
  })
  const byId = new Map(answered.answers.map(a => [a.id, a]))
  const anyReal = answered.answers.some(a => {
    const t = (a.custom?.trim() || a.selected?.[0]?.trim() || '').trim()
    return t !== '' && t !== '（空）'
  })
  // Whole-form skip / dismiss / empty picks → keep offered defaults (never wipe).
  if (!anyReal) {
    return [...params]
  }
  const next: RecipeParamKv[] = []
  for (const p of params) {
    const row = byId.get(`webclaw-param:${p.name}`)
    if (!row) {
      next.push({ name: p.name, value: p.value })
      continue
    }
    const picked = (row.custom?.trim() || row.selected?.[0]?.trim() || '').trim()
    if (picked === '取消' || /^cancel$/i.test(picked)) {
      return 'cancelled'
    }
    // Empty / skip for this field → keep prior default, do not blank it out.
    if (!picked) {
      next.push({ name: p.name, value: p.value })
      continue
    }
    const value = picked === '（空）' ? '' : picked
    next.push({ name: p.name, value })
  }
  return next
}

/** Plain JSON rows for tool results (dsh-tools JsonValue). */
function paramsJson(
  params: readonly RecipeParamKv[],
): Array<{ name: string; value: string }> {
  return params.map(p => ({ name: p.name, value: p.value }))
}

function recipesCfg(config: Config): RecipesConfig {
  return {
    recipesDir: config.recipesDir || undefined,
    recipesRel: config.recipesRel || 'recipes',
    webclawHome: config.webclawHome || undefined,
  }
}

type UserQuestionsAsk = (request: {
  questions: Array<{
    id: string
    question: string
    header?: string
    detail?: string
    options?: Array<{ label: string; description?: string }>
  }>
  agent?: unknown
  signal?: AbortSignal
}) => Promise<{
  answers: Array<{ id: string; selected: string[]; custom?: string }>
}>

/** Soft-bound when `@deepseek-ai/dsh-user-questions` is in the composition. */
let askUserQuestions: UserQuestionsAsk | null = null

/**
 * When ask-user UI is unavailable, require a prior needParams round-trip before
 * trusting `paramsConfirmed=true` (models otherwise skip the human).
 */
const pendingParamGates = new Map<string, number>()

/**
 * Per DSH chat-session values the human already confirmed. Survives recipe
 * body changes on failure→patch retries so we do not re-interview the same
 * fields — but MUST NOT leak across different chats in the same Host process.
 *
 * Tool-supplied `params` are form prefills only; they never count as human OK.
 */
type SessionParamBag = { readonly at: number; readonly byName: Map<string, string> }
const confirmedByChatSession = new Map<string, SessionParamBag>()
const SESSION_PARAM_TTL_MS = 2 * 60 * 60 * 1000

function chatSessionKey(sessionId?: string): string {
  const id = sessionId?.trim()
  // No chat id → isolate by process so we never treat Host-wide as "confirmed".
  return id && id !== '' ? `chat:${id}` : `anon:${process.pid}`
}

function touchSessionParams(sessionId?: string): Map<string, string> {
  const key = chatSessionKey(sessionId)
  const cutoff = Date.now() - SESSION_PARAM_TTL_MS
  for (const [k, bag] of confirmedByChatSession) {
    if (bag.at < cutoff) confirmedByChatSession.delete(k)
  }
  const bag = confirmedByChatSession.get(key)
  return bag?.byName ?? new Map<string, string>()
}

function rememberConfirmedParams(
  params: readonly RecipeParamKv[],
  sessionId?: string,
): void {
  const key = chatSessionKey(sessionId)
  const byName = new Map(touchSessionParams(sessionId))
  for (const p of params) {
    const name = p.name.trim()
    if (!name) continue
    byName.set(name, p.value)
  }
  confirmedByChatSession.set(key, { at: Date.now(), byName })
}

function seedParamsFromSession(
  params: readonly RecipeParamKv[],
  overrides?: Record<string, string> | null,
  sessionId?: string,
): RecipeParamKv[] {
  const confirmed = touchSessionParams(sessionId)
  return params.map(p => {
    const fromOverride = overrides?.[p.name]
    if (fromOverride != null && String(fromOverride).trim() !== '') {
      return { name: p.name, value: String(fromOverride) }
    }
    if (confirmed.has(p.name)) {
      return { name: p.name, value: confirmed.get(p.name) ?? '' }
    }
    return { name: p.name, value: p.value }
  })
}

/**
 * Fields that still need a human confirm UI / needParams round-trip.
 * Prefill from tool `params` or recipe defaults does NOT skip the ask.
 */
function paramsNeedingAsk(
  params: readonly RecipeParamKv[],
  sessionId?: string,
): RecipeParamKv[] {
  const confirmed = touchSessionParams(sessionId)
  return params.filter(p => !confirmed.has(p.name))
}

function paramGateKey(sourcePath: string | undefined, content: string): string {
  if (sourcePath) return `path:${sourcePath}`
  const head = content.slice(0, 120).replace(/\s+/g, ' ')
  return `body:${content.length}:${head}`
}

function armParamGate(key: string): void {
  pendingParamGates.set(key, Date.now())
  // Drop stale entries (1h).
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [k, at] of pendingParamGates) {
    if (at < cutoff) pendingParamGates.delete(k)
  }
}

function consumeParamGate(key: string): boolean {
  if (!pendingParamGates.has(key)) return false
  pendingParamGates.delete(key)
  return true
}

function logSoftHitlReady(ctx: Context): void {
  try {
    ctx.logger.info(
      'webclaw: userQuestions bound — captcha HITL + recipe param confirm will ask the human in-chat',
    )
  } catch {
    /* ignore */
  }
}

function writeHumanReplyText(runDir: string, text: string): void {
  const human = join(runDir, 'human')
  mkdirSync(human, { recursive: true })
  writeFileSync(join(human, 'human_reply.txt'), `${text.trim()}\n`, 'utf8')
}

/**
 * Block the tool call on the native ask-user UI (not the LLM) until the human
 * types the captcha, then resume the parked lite process.
 */
async function resolveNeedHumanWithUser(
  result: SpawnResult,
  opts: {
    home: string
    lite: LiteEnv
    exec: { signal?: AbortSignal; agent?: unknown }
    finalizeCtx: {
      path: string
      mergedParams: Array<{ name: string; value: string }>
      missingCreds: ReadonlyArray<{
        query: string
        id: string
        name: string
        url: string
        reason: string
      }>
      cwd?: string
      sessionId?: string
      vision?: { preferOcr: boolean; supportsImage: boolean }
      captchaOcrText?: string
    }
  },
): Promise<Record<string, any>> {
  let current = result
  // Cap nested captcha loops (wrong human code → another NEED_HUMAN).
  for (let round = 0; round < 5; round++) {
    if (!(current.earlyHitl && current.needHuman)) {
      return finalizeRunResult(current, opts.finalizeCtx)
    }
    const nh = current.needHuman
    const runDir = (current.run_dir || '').trim()
    const hint =
      typeof nh.hint === 'string' && nh.hint.trim()
        ? nh.hint.trim()
        : '请输入验证码'
    const image =
      (typeof nh.inbox_image === 'string' && nh.inbox_image) ||
      (typeof nh.image_path === 'string' && nh.image_path) ||
      ''

    if (!askUserQuestions) {
      // No UI channel — fall back to model-mediated NEED_HUMAN (previous behaviour).
      return finalizeRunResult(current, opts.finalizeCtx)
    }

    let code = ''
    try {
      const answered = await askUserQuestions({
        questions: [
          {
            id: 'webclaw-captcha',
            header: '验证码',
            question: '请输入图中的验证码（也可看右侧「执行画面」）',
            detail: [hint, image ? `图片：${image}` : '', runDir ? `run_dir：${runDir}` : '']
              .filter(Boolean)
              .join('\n'),
          },
        ],
        agent: opts.exec.agent,
        signal: opts.exec.signal,
      })
      const row =
        answered.answers.find(a => a.id === 'webclaw-captcha') || answered.answers[0]
      code = (row?.custom?.trim() || row?.selected?.[0]?.trim() || '').trim()
    } catch {
      // User cancelled / no provider / aborted — surface NEED_HUMAN to the model.
      return finalizeRunResult(current, opts.finalizeCtx)
    }

    if (!code || code === '取消' || /^cancel$/i.test(code)) {
      if (runDir) {
        try {
          const human = join(runDir, 'human')
          mkdirSync(human, { recursive: true })
          writeFileSync(join(human, 'human_reply.json'), '{"cancel":true}\n', 'utf8')
        } catch {
          /* ignore */
        }
      }
      cancelActiveHitl(opts.home)
      return {
        ok: false,
        cancelled: true,
        code: 'RUN_CANCELLED',
        error: '用户取消了验证码输入',
        run_dir: runDir,
        recipePath: opts.finalizeCtx.path,
        params: opts.finalizeCtx.mergedParams,
      }
    }

    if (runDir) {
      writeHumanReplyText(runDir, code)
    } else {
      // Fallback CLI when run_dir missing.
      await runLite(opts.lite, ['human-reply', '--text', code], {
        signal: opts.exec.signal,
      })
    }

    const continued = await resumeActiveHitl({
      signal: opts.exec.signal,
      earlyHitl: true,
    })
    if (!continued) {
      return {
        ok: true,
        note: 'captcha reply written; parked run already finished',
        run_dir: runDir,
        recipePath: opts.finalizeCtx.path,
        params: opts.finalizeCtx.mergedParams,
      }
    }
    if (continued.run_dir) {
      void publishLiveFocus(opts.home, continued.run_dir)
    }
    current = continued
  }
  return finalizeRunResult(current, opts.finalizeCtx)
}

function finalizeRunResult(
  result: SpawnResult,
  ctx: {
    path: string
    mergedParams: Array<{ name: string; value: string }>
    missingCreds: ReadonlyArray<{
      query: string
      id: string
      name: string
      url: string
      reason: string
    }>
    cwd?: string
    sessionId?: string
    /** When set, text-only models get OCR text instead of an image block. */
    vision?: { preferOcr: boolean; supportsImage: boolean }
    /** Precomputed OCR for captcha when preferOcr. */
    captchaOcrText?: string
  },
): Record<string, any> {
  if (result.cancelled) {
    return {
      ok: false,
      cancelled: true,
      code: 'RUN_CANCELLED',
      error: '已取消（Host 停止或 webclaw_cancel）',
      run_dir: result.run_dir || '',
      eventsTail: redactSecrets(result.stdout.slice(-4000)),
      recipePath: ctx.path,
      params: ctx.mergedParams,
    }
  }
  if (result.earlyHitl && result.needHuman) {
    const nh = result.needHuman
    const hint =
      typeof nh.hint === 'string' && nh.hint.trim()
        ? nh.hint.trim()
        : '需要验证码或人机确认'
    const image =
      (typeof nh.inbox_image === 'string' && nh.inbox_image) ||
      (typeof nh.image_path === 'string' && nh.image_path) ||
      ''
    const preferOcr = ctx.vision?.preferOcr !== false && ctx.vision?.supportsImage !== true
    const ocrText = (ctx.captchaOcrText || '').trim()
    return {
      ok: false,
      needHuman: true,
      code: 'NEED_HUMAN',
      error: preferOcr
        ? 'NEED_HUMAN：当前模型无可靠读图能力。已尽量 OCR；请把识别文字/路径给用户确认，索要验证码字符后 webclaw_human_reply。禁止把原图塞给文本模型。'
        : 'NEED_HUMAN：必须立刻向用户展示验证码图并索要字符，禁止自行猜测/空等/只说「请查看浏览器」。拿到字符后调用 webclaw_human_reply(mode="text", text=用户输入, run_dir=本字段)。禁止在未询问用户的情况下继续其它工具。',
      hint,
      kind: typeof nh.kind === 'string' ? nh.kind : 'captcha',
      prompt_id: typeof nh.prompt_id === 'string' ? nh.prompt_id : '',
      image_path: image,
      // Text-only models: omit image injection in render when we have OCR / preferOcr.
      injectImage: !preferOcr,
      ocrText: ocrText || undefined,
      preferOcr,
      run_dir: result.run_dir || '',
      eventsTail: redactSecrets(result.stdout.slice(-4000)),
      recipePath: ctx.path,
      params: ctx.mergedParams,
    }
  }
  const done = parseDoneEvent(result.stdout)
  const ok =
    done != null
      ? done.ok === true && (result.code === 0 || result.code == null)
      : result.code === 0
  const errorText =
    done?.error ||
    (ok
      ? ''
      : (result.stderr ||
          (done
            ? `run failed (ok=${done.okCount ?? '?'}, fail=${done.fail ?? '?'})`
            : 'run failed: no done event')
        ).slice(0, 500))
  const needsCredHint =
    !ok &&
    ctx.missingCreds.length > 0 &&
    /账号|密码|网站账号|凭据/u.test(errorText)
  const runDir = done?.run_dir || result.run_dir || ''
  const payload: Record<string, any> = {
    ok,
    exitCode: result.code ?? -1,
    okCount: done?.okCount ?? null,
    fail: done?.fail ?? null,
    run_dir: runDir,
    params: ctx.mergedParams,
    ...(ctx.missingCreds.length > 0
      ? { missingCredentials: [...ctx.missingCreds] }
      : {}),
    ...(needsCredHint ? { setupHint: CREDENTIALS_SETUP_HINT } : {}),
    error: errorText,
    eventsTail: redactSecrets(result.stdout.slice(-8000)),
    recipePath: ctx.path,
  }
  if (ok && runDir && ctx.cwd?.trim()) {
    const promoted = promoteRunDeliverables({
      runDir,
      cwd: ctx.cwd,
      sessionId: ctx.sessionId,
    })
    if (promoted.outputs.length > 0) {
      payload.workspaceOutputDir = promoted.workspaceDir || ''
      payload.workspaceOutputs = promoted.outputs.map((o) => o.rel)
      payload.workspaceOutputPaths = promoted.outputs.map((o) => o.path)
      payload.workspaceOutputsMarked = promoted.marked
      payload.outputsHint =
        '重要产物已同步到工作区 outputs/（不含 live-preview / executions 等过程物）；可在资料库查看'
    }
  }
  return payload
}

function liteEnvFrom(
  config: Config,
  ensured: EnsureLiteResult | undefined,
  timeoutMs?: number,
): LiteEnv {
  return {
    binaryPath: ensured?.binaryPath ?? resolveBinaryPath(config),
    webclawHome: ensured?.webclawHome ?? resolveWebclawHome(config),
    liteBaseUrl: ensured?.liteBaseUrl ?? resolveLiteBaseUrl(config),
    timeoutMs: timeoutMs ?? config.runTimeoutMs,
  }
}

function parseJsonObject(text: string): Record<string, any> | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, any>
  } catch {
    return undefined
  }
}

/** Split tool inputPaths: JSON array string, or comma/newline-separated paths. */
function parseInputPaths(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p || '').trim()).filter(Boolean)
  }
  const text = String(raw || '').trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text) as unknown
      if (Array.isArray(arr)) {
        return arr.map((p) => String(p || '').trim()).filter(Boolean)
      }
    } catch {
      /* fall through */
    }
  }
  return text
    .split(/[\n,;]+/u)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * Register webclaw tools and optional skill; optionally ensure lite at boot.
 */
export function apply(ctx: Context, config: Config): void {
  if (config.registerSkill) {
    // Wait for skills without hard-requiring it in `inject` (keeps tools usable alone).
    ctx.inject(['skills'], skillCtx => {
      registerBundledSkill(skillCtx)
    })
  }

  // Soft: when user-questions UI is present, captcha HITL asks the human in-chat
  // instead of relying on the model to call webclaw_human_reply.
  ctx.inject(['userQuestions'], (scope: Context & { userQuestions?: { ask: UserQuestionsAsk } }) => {
    const ask = scope.userQuestions?.ask?.bind(scope.userQuestions)
    if (!ask) return () => undefined
    askUserQuestions = ask
    logSoftHitlReady(ctx)
    return () => {
      askUserQuestions = null
    }
  })

  // Track live provider/model (UI switches) for vision routing.
  // MUST be a waterfall listener: always await next() and return the assembly.
  // A bare observer that drops next() yields undefined → "Cannot read … 'variables'".
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const assembled = await next()
    try {
      const vars = (assembled?.variables || {}) as Record<string, unknown>
      const agentId =
        context && typeof context === 'object' && 'agent' in context
          ? (context as { agent?: { id?: unknown } }).agent?.id
          : undefined
      rememberAssembledModel(
        agentId != null ? String(agentId) : undefined,
        vars.provider,
        vars.model,
      )
    } catch {
      /* best-effort cache only */
    }
    return assembled ?? assembly
  })

  const log = {
    info: (msg: string, ...args: unknown[]) => ctx.logger.info(msg, ...args),
    warn: (msg: string, ...args: unknown[]) => ctx.logger.warn(msg, ...args),
  }

  const runOcrImage = async (
    lite: LiteEnv,
    imagePath: string,
  ): Promise<{ ok: boolean; text: string; error?: string }> => {
    const result = await runLite(lite, ['scripts', 'ocr-image', '--input', imagePath])
    const textOut = `${result.stdout}\n${result.stderr}`.trim()
    const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(textOut)
    if (parsed?.type === 'ocr_image' && parsed.ok !== false) {
      return { ok: true, text: String(parsed.text || '') }
    }
    return {
      ok: false,
      text: '',
      error: textOut.slice(0, 800) || 'ocr-image failed',
    }
  }

  let lastEnsure: EnsureLiteResult | undefined
  let accountsUi: AccountsUiHandle | null = null

  const ready = async (): Promise<EnsureLiteResult> => {
    lastEnsure = await ensureLite(config, log)
    try {
      await startUi(lastEnsure)
    } catch (error) {
      log.warn(
        'webclaw: accounts UI start failed: %s',
        error instanceof Error ? error.message : error,
      )
    }
    return lastEnsure
  }

  const env = async (timeoutMs?: number): Promise<LiteEnv> => {
    const ensured = await ready()
    return liteEnvFrom(config, ensured, timeoutMs)
  }

  const startUi = async (ensured: EnsureLiteResult): Promise<void> => {
    if (accountsUi || !config.accountsUi) return
    // Use the already-resolved lite env — do not call ready()/env() (re-entrancy).
    accountsUi = await startAccountsUiServer({
      enabled: config.accountsUi,
      preferredPort: config.accountsUiPort || ACCOUNTS_UI_DEFAULT_PORT,
      getEnv: async () => liteEnvFrom(config, ensured, 60_000),
      home: ensured.webclawHome,
      binaryPath: ensured.binaryPath,
      log,
    })
  }

  ctx.effect(() => {
    return () => {
      const home = resolveWebclawHome({ webclawHome: config.webclawHome })
      try {
        clearLiveFocus(home)
      } catch {
        /* best-effort */
      }
      accountsUi?.clearFocus()
      accountsUi?.close()
      accountsUi = null
      // CDP Chrome is detached from the Host process — stop it on Host teardown.
      const ensured = lastEnsure
      if (ensured) {
        void runLite(liteEnvFrom(config, ensured, 15_000), ['browser', 'stop']).catch(() => {
          /* best-effort; desktop shutdown also reclaims 19222 */
        })
      }
    }
  }, 'webclaw: accounts UI lifetime')

  if (config.ensureOnBoot || (config.systems?.length ?? 0) > 0 || config.accountsUi) {
    void ready()
      .then(async r => {
        ctx.logger.info(
          'webclaw: ensureOnBoot ok (downloaded=%s path=%s)',
          String(r.downloaded),
          r.binaryPath,
        )
        await ensureConfiguredSystems(config, r, log)
        await startUi(r)
      })
      .catch((error: unknown) => {
        ctx.logger.warn(
          'webclaw: ensureOnBoot failed: %s',
          error instanceof Error ? error.message : error,
        )
      })
  }

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_status',
          description:
            'Check local webclaw-lite readiness (Chrome path, product, chromeOk). Prefer this before run when unsure the CLI is installed. On Windows / macOS, missing lite is auto-downloaded from GitHub Releases.',
          parameters: {
            run_id: {
              type: 'string',
              description: 'Optional run id to query waiting-human state',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args): Promise<Record<string, any>> {
            let ensured: EnsureLiteResult
            try {
              ensured = await ready()
            } catch (error) {
              return {
                ok: false,
                product: 'webclaw-lite',
                error: error instanceof Error ? error.message : String(error),
                binaryPath: resolveBinaryPath(config),
              }
            }
            const argv = ['status']
            if (args.run_id?.trim()) {
              argv.push('--run-id', args.run_id.trim())
            }
            const result = await runLite(liteEnvFrom(config, ensured), argv)
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const start = text.indexOf('{')
            const end = text.lastIndexOf('}')
            let status: Record<string, any> = {
              ok: false,
              exitCode: result.code,
              raw: text.slice(0, 2000),
            }
            if (start >= 0 && end > start) {
              try {
                status = JSON.parse(text.slice(start, end + 1)) as Record<string, any>
              } catch {
                /* keep raw */
              }
            }
            status.exitCode = result.code ?? -1
            status.binaryPath = ensured.binaryPath
            return status
          },
        }),
      ),
    'webclaw: tool webclaw_status',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_run',
          description:
            'PRIMARY tool for browser RPA. User phrases 打开/点击/输入/等待/采集/登录 are recipe VERBS — call this with a Chinese recipe string (e.g. recipe="打开旧MES系统" or "打开https://a.com，等待5，采集表格"). Do NOT stop after accounts lookup. NEVER open via Start-Process / default browser. Full/frozen recipe → ONE call (prefer recipePath). KEEP 参数名=值 / {{名}} — never expand defaults into the body before run. Host confirms params once per session; on failure→patch retry REUSE the same params (paramsConfirmed=true + params object) — do NOT re-ask or blank them. Probe steps: keep `(点击取消?)` / `（点击已有项？点击新建）` literally — runtime try/skip-or-fallback; NEVER strip parentheses+?. Ask early on failure: ONE cheap short patch; control-not-found / download pending=0 → STOP and ask. Agent download waits: 等待下载30/60. No CSS/Playwright. Agent second-waits: ONLY 等待2/等待5.',
          parameters: {
            recipe: {
              type: 'string',
              description:
                'Inline Chinese recipe using verbs 打开/登录/点击/输入/等待/采集… joined by ，. Example: 登录旧MES系统，等待5  or  点击保存，等待2. Agent may ONLY use 等待{秒数}; do not invent wait text/targets. User saying「打开MES」→ put that verb into this field and run. Mutually exclusive with recipePath.',
            },
            recipePath: {
              type: 'string',
              description:
                'Path to .webclaw file: workspace-relative, recipes/<name>, absolute, or attachment read path. Prefer this when a frozen/uploaded file already exists.',
            },
            title: {
              type: 'string',
              description: 'Optional run title',
            },
            // Loose schema: models pass object or JSON string; Host parses both.
            // Must declare type — typeless params make defineTool abort the whole fiber.
            params: {
              type: 'json',
              description:
                'Param overrides. Prefer object {"休假项目":"年假",...}; JSON string also ok.',
            },
            paramsConfirmed: {
              type: 'boolean',
              description:
                'Set true only after the user confirmed/edited params (or Host already collected them via ask-user). Never set true to skip first confirmation. When Host has userQuestions, interactive confirm runs anyway before the browser starts.',
            },
            headless: {
              type: 'boolean',
              description:
                'Optional one-shot only. Prefer webclaw_set_display for sticky takeover. After user 接管 (display.json headless=false), OMIT this so later runs stay headed until user asks for 无头.',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
              const v = value as {
                ok?: boolean
                needParams?: boolean
                needHuman?: boolean
                cancelled?: boolean
                form?: string
                setupHint?: string
                run_dir?: string
                error?: string
                hint?: string
                image_path?: string
                eventsTail?: string
                recipePath?: string
              }
              if (v.needParams && v.form) {
                return [{ type: 'text', text: v.form }]
              }
              if (v.needHuman) {
                const preferOcr = (v as { preferOcr?: boolean }).preferOcr === true
                const ocrText = String((v as { ocrText?: string }).ocrText || '').trim()
                const injectImage =
                  (v as { injectImage?: boolean }).injectImage !== false && !preferOcr
                const blocks: Array<{ type: string; text?: string; source?: unknown }> = [{
                  type: 'text',
                  text: [
                    preferOcr
                      ? 'webclaw_run: NEED_HUMAN（当前模型无读图；已走本地 OCR，请向用户确认验证码）'
                      : 'webclaw_run: NEED_HUMAN（请立刻把验证码图给用户看，并索要字符）',
                    v.hint ? `hint: ${v.hint}` : '',
                    ocrText ? `ocr: ${ocrText}` : '',
                    v.image_path ? `image: ${v.image_path}` : '',
                    v.run_dir ? `run_dir: ${v.run_dir}` : '',
                    preferOcr
                      ? '下一步：把 OCR/路径给用户 → 用户回字符 → webclaw_human_reply(mode=text, text=…, run_dir=…)'
                      : '下一步：展示图片 → 用户回字符 → webclaw_human_reply(mode=text, text=…, run_dir=…)',
                  ].filter(Boolean).join('\n'),
                }]
                if (injectImage && v.image_path) {
                  try {
                    const bytes = readFileSync(v.image_path)
                    blocks.push({
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: 'image/png',
                        data: bytes.toString('base64'),
                      },
                    })
                  } catch {
                    /* path may be unavailable; text path remains */
                  }
                }
                return blocks as [{ type: 'text'; text: string }]
              }
              const lines = [
                v.cancelled
                  ? 'webclaw_run: cancelled'
                  : v.ok
                    ? 'webclaw_run: ok'
                    : 'webclaw_run: failed',
                v.recipePath ? `recipePath: ${v.recipePath}` : '',
                v.run_dir ? `run_dir: ${v.run_dir}` : '',
                v.error ? `error: ${v.error}` : '',
                v.setupHint ? v.setupHint : '',
                v.eventsTail ? v.eventsTail.slice(-4000) : '',
              ].filter(Boolean)
              return [{ type: 'text', text: lines.join('\n') }]
            },
          },
          async execute(args, exec): Promise<Record<string, any>> {
            const inline = args.recipe?.trim() ?? ''
            const pathArg = args.recipePath?.trim() ?? ''
            if (inline && pathArg) {
              throw new Error('pass either recipe or recipePath, not both')
            }
            if (!inline && !pathArg) {
              throw new Error('recipe or recipePath is required')
            }
            const cwd = agentCwd(exec)
            const sourcePath = pathArg
              ? resolveRecipePath(recipesCfg(config), pathArg, cwd)
              : undefined
            const rawContent = sanitizeWebclawRecipe(
              inline
                ? inline
                : readFileSync(sourcePath!, { encoding: 'utf8' }),
            )

            const declared = extractRecipeParams(rawContent)
            // Tool schema may deliver object or string; parseParamsArg accepts both.
            let overrides = parseParamsArg(
              (args as { params?: unknown }).params,
            )
            const confirmed = args.paramsConfirmed === true
            // Gate on 参数…= / {{名}} / tool params — not only explicit 参数 lines
            // (models often expand defaults into the body and skip confirm).
            const confirmable = collectConfirmableParams(rawContent, overrides)
            const gateKey = paramGateKey(sourcePath, rawContent)

            if (config.requireParamConfirm && confirmable.length > 0) {
              const preview = applyParamOverrides(rawContent, overrides)
              // Prefer confirmable list (includes mustache / params-arg keys).
              const baseParams =
                preview.params.length >= confirmable.length
                  ? preview.params
                  : confirmable.map(p => {
                      const hit = preview.params.find(x => x.name === p.name)
                      return hit ?? p
                    })
              const chatSid = agentSessionId(exec)
              // Prefill from tool params / recipe defaults; only prior human
              // confirms in THIS chat session skip the ask.
              const previewParams = seedParamsFromSession(baseParams, overrides, chatSid)
              const needAsk = paramsNeedingAsk(previewParams, chatSid)

              if (askUserQuestions) {
                let picked: RecipeParamKv[] = previewParams
                if (needAsk.length === 0) {
                  // Human already confirmed every field earlier in this chat.
                  rememberConfirmedParams(previewParams, chatSid)
                } else {
                  try {
                    const answered = await confirmRecipeParamsWithUser(
                      needAsk.length < previewParams.length ? needAsk : previewParams,
                      exec,
                    )
                    if (answered === 'cancelled') {
                      return {
                        ok: false,
                        cancelled: true,
                        code: 'PARAMS_CANCELLED',
                        error: '用户取消了参数确认',
                        params: paramsJson(previewParams),
                        recipePath: sourcePath ?? '',
                      }
                    }
                    const byName = new Map(previewParams.map(p => [p.name, p.value]))
                    for (const p of answered) byName.set(p.name, p.value)
                    picked = previewParams.map(p => ({
                      name: p.name,
                      value: byName.get(p.name) ?? p.value,
                    }))
                    rememberConfirmedParams(picked, chatSid)
                  } catch {
                    // UI cancelled / unavailable — fall back to model-mediated form
                    // unless a prior needParams gate was armed + paramsConfirmed,
                    // or this chat already confirmed every field.
                    if (needAsk.length > 0 && (!confirmed || !consumeParamGate(gateKey))) {
                      armParamGate(gateKey)
                      return {
                        ok: false,
                        needParams: true,
                        params: paramsJson(previewParams),
                        form: formatParamForm(previewParams),
                        error:
                          'needParams: show the editable param table once; wait for user edits; do not start the browser yet',
                        recipePath: sourcePath ?? '',
                      }
                    }
                    picked = previewParams
                    rememberConfirmedParams(picked, chatSid)
                  }
                }
                overrides = Object.fromEntries(picked.map(p => [p.name, p.value]))
                pendingParamGates.delete(gateKey)
              } else if (needAsk.length > 0 && (!confirmed || !consumeParamGate(gateKey))) {
                armParamGate(gateKey)
                return {
                  ok: false,
                  needParams: true,
                  params: paramsJson(previewParams),
                  form: formatParamForm(previewParams),
                  error:
                    'needParams: show the editable param table once; wait for user edits (not verbal interview); do not start the browser yet',
                  recipePath: sourcePath ?? '',
                }
              } else {
                // This chat already confirmed every field (retry / second call).
                rememberConfirmedParams(previewParams, chatSid)
                overrides = Object.fromEntries(
                  previewParams.map(p => [p.name, p.value]),
                )
              }
            }

            const merged = applyParamOverrides(rawContent, overrides)

            // Soft status only — never block open for missing password (SSO / session OK).
            const lite = await env()
            // Re-apply deploy systems (URL + optional test credentials).
            if ((config.systems?.length ?? 0) > 0) {
              const ensured = await ready()
              await ensureConfiguredSystems(config, ensured, log)
            }
            const listed = await listAccounts(lite)
            const missingCreds = missingCredentialsForRecipe(
              merged.content,
              listed.items,
            )

            const path =
              confirmable.length > 0 || declared.length > 0 || overrides
                ? writeTempRecipe(merged.content)
                : sourcePath ?? writeTempRecipe(rawContent)

            const argv = ['run', '--recipe', path]
            if (args.title?.trim()) {
              argv.push('--title', args.title.trim())
            }
            const headlessArg = (args as { headless?: boolean }).headless
            if (headlessArg === true) argv.push('--headless')
            else if (headlessArg === false) argv.push('--headed')
            const home = resolveWebclawHome({ webclawHome: config.webclawHome })
            // Host Stop aborts exec.signal → cancel marker + kill. earlyHitl returns
            // on captcha so the agent can ask the user (OCR already tried submit).
            const result = await runLite(lite, argv, {
              signal: exec.signal,
              earlyHitl: true,
              onRunDir: dir => {
                void publishLiveFocus(home, dir)
              },
            })
            if (result.run_dir) {
              void publishLiveFocus(home, result.run_dir)
            }
            const vision = await resolveVisionCapability(ctx, exec)
            let captchaOcrText = ''
            if (result.earlyHitl && result.needHuman && vision.preferOcr) {
              const nh = result.needHuman
              const image =
                (typeof nh.inbox_image === 'string' && nh.inbox_image) ||
                (typeof nh.image_path === 'string' && nh.image_path) ||
                ''
              if (image) {
                const ocr = await runOcrImage(lite, image)
                if (ocr.ok) captchaOcrText = ocr.text
              }
            }
            const finalizeCtx = {
              path,
              mergedParams: paramsJson(merged.params),
              missingCreds,
              cwd: agentCwd(exec),
              sessionId: agentSessionId(exec),
              vision: {
                preferOcr: vision.preferOcr,
                supportsImage: vision.supportsImage,
              },
              captchaOcrText,
            }
            if (result.earlyHitl && result.needHuman) {
              return resolveNeedHumanWithUser(result, {
                home,
                lite,
                exec,
                finalizeCtx,
              })
            }
            return finalizeRunResult(result, finalizeCtx)
          },
        }),
      ),
    'webclaw: tool webclaw_run',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_set_display',
          description:
            'Persist sticky Chrome display mode to display.json and IMMEDIATELY restart Chrome in that mode so the window appears (or hides). User「接管/我来点/弹出浏览器/改成有头」→ headless=false and KEEP headed until user explicitly says「隐藏浏览器/改成无头」→ headless=true. Do not auto-revert after runs. Mode switch recycles Chrome (current page may reset; cookies usually kept). Default product mode is headless.',
          parameters: {
            headless: {
              type: 'boolean',
              required: true,
              description:
                'true = hide browser (headless); false = show Chrome window for user takeover. Sticky until changed again.',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args): Promise<Record<string, any>> {
            const headless = args.headless === true
            const argv = ['display', '--headless', headless ? '1' : '0']
            const ensured = await ready()
            const result = await runLite(liteEnvFrom(config, ensured, 15_000), argv)
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text)
            if (parsed) {
              return {
                ...parsed,
                ok: parsed.ok !== false && (result.code === 0 || result.code == null),
                exitCode: result.code ?? -1,
              }
            }
            return {
              ok: result.code === 0,
              exitCode: result.code ?? -1,
              headless,
              raw: text.slice(0, 2000),
            }
          },
        }),
      ),
    'webclaw: tool webclaw_set_display',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_browser',
          description:
            'Control the local webclaw Chrome/CDP instance. User「关掉浏览器/关掉实例/释放浏览器」→ action=stop. status = port/cdpReady/pid; restart = kill+relaunch. NEVER use PowerShell / taskkill / Stop-Process / kill / Start-Process — only this tool. Headless Chrome stays up by design after runs; call stop to free it. Next webclaw_run will launch again.',
          parameters: {
            action: {
              type: 'string',
              required: true,
              description: 'status | stop | restart',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args): Promise<Record<string, any>> {
            const action = String(args.action ?? '')
              .trim()
              .toLowerCase()
            if (!['status', 'stop', 'restart'].includes(action)) {
              throw new Error('action must be status | stop | restart')
            }
            const ensured = await ready()
            const lite = liteEnvFrom(config, ensured, 60_000)
            const home = resolveWebclawHome({ webclawHome: config.webclawHome })
            let cancelNote: Record<string, any> | undefined
            if (action === 'stop' || action === 'restart') {
              try {
                const hitlCancelled = cancelActiveHitl(home)
                writeCancelMarker(home)
                const cancelResult = await runLite(lite, ['cancel'])
                cancelNote = {
                  hitlCancelled,
                  cancelExitCode: cancelResult.code ?? -1,
                }
              } catch (e) {
                cancelNote = {
                  cancelError: String((e as Error)?.message || e).slice(0, 300),
                }
              }
            }
            const result = await runLite(lite, ['browser', action])
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text)
            if (parsed) {
              return {
                ...parsed,
                ok: parsed.ok !== false && (result.code === 0 || result.code == null),
                exitCode: result.code ?? -1,
                ...(cancelNote ? { cancel: cancelNote } : {}),
              }
            }
            return {
              ok: result.code === 0,
              exitCode: result.code ?? -1,
              action,
              raw: text.slice(0, 2000),
              ...(cancelNote ? { cancel: cancelNote } : {}),
            }
          },
        }),
      ),
    'webclaw: tool webclaw_browser',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_accounts_status',
          description:
            'LOOKUP ONLY: list local vault sites (id/name/url/username/has_password — NEVER passwords). Does NOT open a browser. After finding a site (e.g. 旧MES), you MUST still call webclaw_run with a recipe verb like 打开旧MES系统 / 登录旧MES系统. SSO URLs need NO password. Never ask for passwords or invent accounts-set CLI.',
          parameters: {},
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
              return [
                {
                  type: 'text',
                  text: typeof value === 'object'
                    ? JSON.stringify(value, null, 2)
                    : String(value),
                },
              ]
            },
          },
          async execute(): Promise<Record<string, any>> {
            const ensured = await ready()
            if ((config.systems?.length ?? 0) > 0) {
              await ensureConfiguredSystems(config, ensured, log)
            }
            const listed = await listAccounts(liteEnvFrom(config, ensured))
            const needsUrl = listed.items.filter(it => !it.url.trim())
            const needsSsoUrl = listed.items.filter(
              it =>
                !!it.url.trim() &&
                !isSsoAccountUrl(it.url) &&
                /hcmcloud|\behr\b/i.test(`${it.id} ${it.name} ${it.url}`),
            )
            return {
              ok: listed.ok,
              type: 'accounts',
              items: listed.items.map(it => ({
                id: it.id,
                name: it.name,
                url: it.url,
                username: it.username,
                has_password: it.has_password,
                sso: isSsoAccountUrl(it.url),
                // Never signal passwordRequired — models invent `accounts set` otherwise.
                passwordRequired: false,
              })),
              incompleteCredentials: needsUrl.length > 0,
              incomplete: needsUrl.map(it => ({
                id: it.id,
                name: it.name,
                reason: 'missing_url',
              })),
              setupHint:
                needsUrl.length > 0
                  ? CREDENTIALS_SETUP_HINT
                  : needsSsoUrl.length > 0
                    ? 'EHR URL missing sso=lark — user should fix 设置 → 网站账号 URL only. Never ask for passwords or invent accounts set CLI.'
                    : 'OK to webclaw_run. Never ask for passwords or invent accounts set CLI.',
              error: listed.error || '',
              binaryPath: ensured.binaryPath,
            }
          },
        }),
      ),
    'webclaw: tool webclaw_accounts_status',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_inspect_params',
          description:
            'Extract editable 参数名=值 fields from a recipe. Prefer letting webclaw_run return needParams. Show table once for user to edit; then webclaw_run with paramsConfirmed=true + params JSON. Do not interview field-by-field.',
          parameters: {
            recipe: {
              type: 'string',
              description: 'Inline recipe body. Mutually exclusive with recipePath.',
            },
            recipePath: {
              type: 'string',
              description: 'Path to .webclaw file',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
              const v = value as {
                form?: string
                params?: RecipeParamKv[]
                error?: string
              }
              if (v.form) return [{ type: 'text', text: v.form }]
              if (v.error) return [{ type: 'text', text: v.error }]
              return [
                {
                  type: 'text',
                  text: JSON.stringify(v.params ?? [], null, 2),
                },
              ]
            },
          },
          async execute(args, exec): Promise<Record<string, any>> {
            const inline = args.recipe?.trim() ?? ''
            const pathArg = args.recipePath?.trim() ?? ''
            if (inline && pathArg) {
              throw new Error('pass either recipe or recipePath, not both')
            }
            if (!inline && !pathArg) {
              throw new Error('recipe or recipePath is required')
            }
            const cwd = agentCwd(exec)
            const content = sanitizeWebclawRecipe(
              inline
                ? inline
                : readFileSync(
                    resolveRecipePath(recipesCfg(config), pathArg, cwd),
                    { encoding: 'utf8' },
                  ),
            )
            const params = extractRecipeParams(content)
            return {
              ok: true,
              params: paramsJson(params),
              form:
                params.length > 0
                  ? formatParamForm(params)
                  : '（该菜谱没有「参数」声明，可直接 webclaw_run）',
              hint:
                params.length > 0
                  ? 'Show editable table once; after user edits → webclaw_run(..., paramsConfirmed=true, params={...})'
                  : 'No static params; run directly',
            }
          },
        }),
      ),
    'webclaw: tool webclaw_inspect_params',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_freeze',
          description:
            'LOCAL freeze only: write a COMPLETE updated recipe as UTF-8 recipes/<name>.webclaw. On DSH/蜂行, skill body is primary — any save_skill (update/asCopy) or freeze requires explicit user consent; never silent/default persist after a successful run. Prefer showing the recipe in chat first. Replay with webclaw_run(recipePath).',
          parameters: {
            name: {
              type: 'string',
              required: true,
              description:
                'Recipe stem (becomes <name>.webclaw). Local library only — not a substitute for updating/copying a DSH skill.',
            },
            recipe: {
              type: 'string',
              required: true,
              description: 'Full merged recipe body (entire flow, not patch-only)',
            },
            title: {
              type: 'string',
              description: 'Optional # title line prepended when body has no leading #',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
              const v = value as { path?: string; name?: string; hint?: string }
              return [
                {
                  type: 'text',
                  text: [
                    `webclaw_freeze: ${v.name ?? ''}`,
                    v.path ? `path: ${v.path}` : '',
                    v.hint ?? '',
                  ]
                    .filter(Boolean)
                    .join('\n'),
                },
              ]
            },
          },
          async execute(args, exec) {
            const saved = freezeRecipe({
              config: recipesCfg(config),
              name: args.name,
              recipe: args.recipe,
              title: args.title,
              cwd: agentCwd(exec),
            })
            return {
              ok: true,
              ...saved,
              hint: 'Open this path in Files for plain-text preview; edit via open-in-app or fs tools; replay with webclaw_run(recipePath).',
            }
          },
        }),
      ),
    'webclaw: tool webclaw_freeze',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_list_recipes',
          description: 'List frozen .webclaw files in the local recipes library (workspace recipes/ or WEBCLAW_HOME/recipes).',
          parameters: {},
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(_args, exec) {
            const listed = listRecipes(recipesCfg(config), agentCwd(exec))
            return { type: 'recipes', ...listed }
          },
        }),
      ),
    'webclaw: tool webclaw_list_recipes',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_script_list',
          description:
            'List local Rhai business scripts (Excel/file ops: e.g. 合并考勤数据). No browser. WeChat-local scripts are hidden. Prefer these over Python for tabular office work when a matching script exists.',
          parameters: {},
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(): Promise<Record<string, any>> {
            const lite = await env(30_000)
            const result = await runLite(lite, ['scripts', 'list'])
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text)
            if (parsed && (parsed.type === 'scripts' || Array.isArray(parsed.items))) {
              return {
                ...parsed,
                ok: parsed.ok !== false && (result.code === 0 || result.code == null),
                exitCode: result.code ?? -1,
                binaryPath: lite.binaryPath,
              }
            }
            return {
              ok: result.code === 0,
              type: 'scripts',
              items: [],
              exitCode: result.code ?? -1,
              error: text.slice(0, 800) || 'scripts list failed',
              binaryPath: lite.binaryPath,
            }
          },
        }),
      ),
    'webclaw: tool webclaw_script_list',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_script_run',
          description:
            'Run a local Rhai business script by name (no Chrome). Excel/file merges etc. WeChat-local scripts are refused. Pass args as free text after the name (e.g. 山西阳泉 2026-07). To reuse a prior browser download run, pass fromRunDir=<that run_dir> or inputPaths — NEVER shell Copy-Item/cp under %LOCALAPPDATA%/webclaw/runs or borrow another task’s downloads folder.',
          parameters: {
            name: {
              type: 'string',
              required: true,
              description: 'Script name, e.g. 合并考勤数据',
            },
            args: {
              type: 'string',
              description: 'Arguments after the script name (space-separated free text)',
            },
            fromRunDir: {
              type: 'string',
              description:
                'Prior webclaw run_dir whose downloads/files/documents should be staged (use this instead of shell-copying AppData runs)',
            },
            inputPaths: {
              type: 'string',
              description:
                'File paths to stage into run files/ (comma / newline / JSON array). Prefer over copying between webclaw/runs folders.',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args, exec): Promise<Record<string, any>> {
            const name = String(args.name || '').trim()
            if (!name) {
              return { ok: false, error: 'name is required' }
            }
            const argv = ['scripts', 'run', '--name', name]
            const scriptArgs = String(args.args || '').trim()
            if (scriptArgs) {
              argv.push('--args', scriptArgs)
            }
            const fromRunDir = String(args.fromRunDir || '').trim()
            if (fromRunDir) {
              argv.push('--from-run-dir', fromRunDir)
            }
            const inputs = parseInputPaths(args.inputPaths)
            for (const p of inputs) {
              argv.push('--input', p)
            }
            // Scripts can be long (Excel); reuse run timeout.
            const lite = await env()
            const result = await runLite(lite, argv, { signal: exec.signal })
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text)
            const ok =
              !!parsed &&
              parsed.type === 'script_done' &&
              parsed.ok !== false &&
              (result.code === 0 || result.code == null)
            const runDir =
              (typeof parsed?.run_dir === 'string' && parsed.run_dir) ||
              (typeof parsed?.runDir === 'string' && parsed.runDir) ||
              ''
            const payload: Record<string, any> = {
              ...(parsed || {}),
              ok,
              exitCode: result.code ?? -1,
              run_dir: runDir,
              error: ok
                ? ''
                : (typeof parsed?.error === 'string' && parsed.error) ||
                  text.slice(0, 1200) ||
                  'script run failed',
              binaryPath: lite.binaryPath,
            }
            if (ok && runDir) {
              const promoted = promoteRunDeliverables({
                runDir,
                cwd: agentCwd(exec),
                sessionId: agentSessionId(exec),
              })
              if (promoted.outputs.length > 0) {
                payload.workspaceOutputDir = promoted.workspaceDir || ''
                payload.workspaceOutputs = promoted.outputs.map((o) => o.rel)
                payload.workspaceOutputPaths = promoted.outputs.map((o) => o.path)
                payload.workspaceOutputsMarked = promoted.marked
                payload.outputsHint =
                  '重要产物已同步到工作区 outputs/；可在资料库查看'
              }
            }
            return payload
          },
        }),
      ),
    'webclaw: tool webclaw_script_run',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_read_table',
          description:
            'Peek any local .xlsx/.xls via embedded calamine (no Python, no xlrd/openpyxl). Returns sheet names, headers, and a sample of rows. Use first for unknown Excel files; then webclaw_script_run if a library script matches. Never pip-install Excel libs for a first look.',
          parameters: {
            path: {
              type: 'string',
              required: true,
              description: 'Absolute or resolvable path to .xlsx / .xls',
            },
            sheet: {
              type: 'string',
              description: 'Sheet name or 0-based index (default first sheet)',
            },
            headerRow: {
              type: 'number',
              description: 'Header row index, 0-based (default 0)',
            },
            limit: {
              type: 'number',
              description: 'Max sample data rows (default 20, max 200)',
            },
            maxCols: {
              type: 'number',
              description: 'Max columns to include (default 40, max 100)',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args): Promise<Record<string, any>> {
            const path = String(args.path || '').trim()
            if (!path) {
              return { ok: false, error: 'path is required' }
            }
            const argv = ['scripts', 'read-table', '--input', path]
            const sheet = String(args.sheet || '').trim()
            if (sheet) {
              argv.push('--sheet', sheet)
            }
            if (typeof args.headerRow === 'number' && Number.isFinite(args.headerRow) && args.headerRow >= 0) {
              argv.push('--header-row', String(Math.floor(args.headerRow)))
            }
            if (typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0) {
              argv.push('--limit', String(Math.floor(args.limit)))
            }
            if (typeof args.maxCols === 'number' && Number.isFinite(args.maxCols) && args.maxCols > 0) {
              argv.push('--max-cols', String(Math.floor(args.maxCols)))
            }
            const lite = await env(60_000)
            const result = await runLite(lite, argv)
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text)
            if (parsed && (parsed.type === 'table_peek' || Array.isArray(parsed.headers))) {
              return {
                ...parsed,
                ok: parsed.ok !== false && (result.code === 0 || result.code == null),
                exitCode: result.code ?? -1,
                binaryPath: lite.binaryPath,
              }
            }
            return {
              ok: false,
              type: 'table_peek',
              exitCode: result.code ?? -1,
              error: text.slice(0, 1200) || 'read-table failed',
              binaryPath: lite.binaryPath,
            }
          },
        }),
      ),
    'webclaw: tool webclaw_read_table',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_vision_status',
          description:
            'Detect whether the CURRENT chat model accepts image input (DSH inputModalities). If preferOcr=true / supportsImage=false, do NOT feed images to the model — use webclaw_ocr_image instead. Call before handling user screenshots/attachments when unsure.',
          parameters: {},
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(_args, exec): Promise<Record<string, any>> {
            const vision = await resolveVisionCapability(ctx, exec)
            return {
              ok: true,
              ...vision,
              route: vision.preferOcr
                ? 'use webclaw_ocr_image → reason on text'
                : 'model can read images directly',
            }
          },
        }),
      ),
    'webclaw: tool webclaw_vision_status',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_ocr_image',
          description:
            'Local RapidOCR: image path → text (no multimodal model needed). Use when webclaw_vision_status.preferOcr is true, or any time the model cannot see images. First call may download ONNX models to the machine cache.',
          parameters: {
            path: {
              type: 'string',
              required: true,
              description: 'Absolute or resolvable path to png/jpg/webp/…',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args, exec): Promise<Record<string, any>> {
            const path = String(args.path || '').trim()
            if (!path) {
              return { ok: false, error: 'path is required' }
            }
            const vision = await resolveVisionCapability(ctx, exec)
            // OCR can download models; allow a longer budget.
            const lite = await env(180_000)
            const ocr = await runOcrImage(lite, path)
            return {
              ok: ocr.ok,
              type: 'ocr_image',
              path,
              text: ocr.text,
              error: ocr.error || '',
              vision,
              routeHint: vision.preferOcr
                ? 'Text-only / unknown vision → use this OCR text; do not re-send the image to the model.'
                : 'Model supports images; OCR is optional fallback.',
              binaryPath: lite.binaryPath,
            }
          },
        }),
      ),
    'webclaw: tool webclaw_ocr_image',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_import',
          description:
            'Copy an existing .webclaw (attachment path or any file) into the recipes library for durable replay/edit. Prefer this over treating chat attachments as the long-term store.',
          parameters: {
            sourcePath: {
              type: 'string',
              required: true,
              description: 'Absolute or resolvable path to source .webclaw',
            },
            name: {
              type: 'string',
              description: 'Optional stem override for the destination file',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
          },
          async execute(args, exec) {
            const saved = importRecipe({
              config: recipesCfg(config),
              sourcePath: args.sourcePath,
              name: args.name,
              cwd: agentCwd(exec),
            })
            return {
              ok: true,
              ...saved,
              hint: 'Imported into recipes library. Preview in Files; replay with webclaw_run(recipePath).',
            }
          },
        }),
      ),
    'webclaw: tool webclaw_import',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_probe',
          description:
            'The only allowed “eyes” for page structure. Authoring-only when NO complete recipe exists yet: scan the page (or open url) and return textCmd/indexCmd/clickCmd/inputCmd. After a failed full run, at most ONE probe then edit+rerun once; if still stuck, stop and ask the user. NEVER use PowerShell/raw CDP/WebSocket scripts as a substitute. NEVER call if the user already gave a full recipe/recipePath—use webclaw_run once instead. Do not invent labels.',
          parameters: {
            url: {
              type: 'string',
              description: 'Optional. First hop or explicit site change only; omit after navigation to scan current page',
            },
            types: {
              type: 'string',
              description: 'Comma-separated types, default 输入框,按钮,图标按钮,链接',
            },
            search: {
              type: 'string',
              description: 'Optional keyword filter',
            },
            limit: {
              type: 'number',
              description: 'Max candidates (default 60)',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
              const v = value as {
                ok?: boolean
                url?: string
                candidateCount?: number
                hint?: string
                candidates?: unknown[]
              }
              const head = [
                v.ok === false ? 'webclaw_probe: failed' : 'webclaw_probe: ok',
                v.url ? `url: ${v.url}` : '',
                typeof v.candidateCount === 'number'
                  ? `candidates: ${v.candidateCount}`
                  : '',
                v.hint || '',
              ].filter(Boolean)
              const sample = Array.isArray(v.candidates)
                ? v.candidates.slice(0, 12)
                : []
              return [
                {
                  type: 'text',
                  text: `${head.join('\n')}\n${JSON.stringify(sample, null, 2)}`,
                },
              ]
            },
          },
          async execute(args) {
            const argv = ['probe']
            if (args.url?.trim()) {
              argv.push('--url', args.url.trim())
            }
            if (args.types?.trim()) {
              argv.push('--types', args.types.trim())
            }
            if (args.search?.trim()) {
              argv.push('--search', args.search.trim())
            }
            if (typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0) {
              argv.push('--limit', String(Math.floor(args.limit)))
            }
            const ensured = await ready()
            const result = await runLite(
              liteEnvFrom(config, ensured, config.probeTimeoutMs),
              argv,
            )
            const text = `${result.stdout}\n${result.stderr}`.trim()
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text)
            if (parsed && parsed.type === 'probe') {
              Object.assign(parsed, {
                exitCode: result.code ?? -1,
                binaryPath: ensured.binaryPath,
              })
              return parsed
            }
            return {
              type: 'probe',
              ok: false,
              exitCode: result.code ?? -1,
              error: (result.stderr || result.stdout || 'probe failed').slice(0, 500),
              raw: text.slice(0, 2000),
              binaryPath: ensured.binaryPath,
            }
          },
        }),
      ),
    'webclaw: tool webclaw_probe',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_human_reply',
          description:
            'Resume a NEED_HUMAN pause after OCR failed or captcha still present. Pass user-supplied captcha (mode=text) or slider ok. Then waits for run to finish or next NEED_HUMAN. Do not leave the user waiting — ask for the code as soon as NEED_HUMAN returns.',
          parameters: {
            mode: {
              type: 'string',
              required: true,
              description: 'One of: text | ok | cancel',
            },
            text: {
              type: 'string',
              description: 'Captcha code when mode=text (user-provided only)',
            },
            run_dir: {
              type: 'string',
              description: 'run_dir from the NEED_HUMAN webclaw_run result',
            },
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value) },
            ],
          },
          async execute(args, exec) {
            const mode = args.mode.trim().toLowerCase()
            const argv = ['human-reply']
            if (mode === 'ok') argv.push('--ok')
            else if (mode === 'cancel') argv.push('--cancel')
            else if (mode === 'text') {
              if (!args.text?.trim()) throw new Error('text required when mode=text')
              argv.push('--text', args.text.trim())
            } else {
              throw new Error('mode must be text|ok|cancel')
            }
            if (args.run_dir?.trim()) {
              argv.push('--run-dir', args.run_dir.trim())
            }
            const lite = await env()
            const ack = await runLite(lite, argv, { signal: exec.signal })
            if (ack.code !== 0 && ack.code != null) {
              return {
                ok: false,
                exitCode: ack.code,
                error: (ack.stderr || ack.stdout || 'human-reply failed').slice(0, 500),
              }
            }
            if (!hasActiveHitl()) {
              return {
                ok: true,
                exitCode: 0,
                note: 'reply written; no parked run (lite may already have continued)',
                stdout: ack.stdout.trim().slice(0, 1000),
              }
            }
            const continued = await resumeActiveHitl({
              signal: exec.signal,
              earlyHitl: true,
            })
            if (!continued) {
              return { ok: true, exitCode: 0, note: 'reply written' }
            }
            return finalizeRunResult(continued, {
              path: args.run_dir?.trim() || '',
              mergedParams: [],
              missingCreds: [],
              cwd: agentCwd(exec),
              sessionId: agentSessionId(exec),
            })
          },
        }),
      ),
    'webclaw: tool webclaw_human_reply',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'webclaw_cancel',
          description:
            'Stop the current webclaw-lite run immediately (Host Stop should also abort the in-flight webclaw_run). Writes control/cancel and kills the child.',
          parameters: {},
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
              { type: 'text', text: JSON.stringify(value) },
            ],
          },
          async execute() {
            const lite = await env()
            const home = resolveWebclawHome({ webclawHome: config.webclawHome })
            const hitlCancelled = cancelActiveHitl(home)
            writeCancelMarker(home)
            const result = await runLite(lite, ['cancel'])
            return {
              ok: true,
              cancelled: true,
              hitlCancelled,
              exitCode: result.code ?? -1,
              stdout: result.stdout.trim().slice(0, 1000),
              stderr: result.stderr.trim().slice(0, 500),
            }
          },
        }),
      ),
    'webclaw: tool webclaw_cancel',
  )
}
