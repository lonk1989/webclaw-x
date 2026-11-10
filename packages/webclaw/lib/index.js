/**
 * @lonk1989/webclaw — recipe-level browser RPA for DeepSeek Harness.
 *
 * Registers task tools that spawn webclaw-lite. Does not claim ctx.browserUse.
 * On Windows / macOS, ensureOnBoot (default true) downloads lite from GitHub Releases.
 * @module
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { ensureLite, resolveBinaryPath, resolveLiteBaseUrl, resolveWebclawHome, } from './ensure-lite.js';
import { cancelActiveHitl, hasActiveHitl, parseDoneEvent, resumeActiveHitl, runLite, writeCancelMarker, writeTempRecipe, } from './spawn.js';
import { agentCwd, freezeRecipe, importRecipe, listRecipes, resolveRecipePath, } from './recipes.js';
import { applyParamOverrides, collectConfirmableParams, extractRecipeParams, parseParamsArg, } from './params.js';
import { redactSecrets } from './redact.js';
import { sanitizeWebclawRecipe } from './url-coerce.js';
import { ACCOUNTS_UI_DEFAULT_PORT, startAccountsUiServer, } from './accounts-ui-server.js';
import { CREDENTIALS_SETUP_HINT, ensureAccount, isSsoAccountUrl, listAccounts, missingCredentialsForRecipe, normalizeSystemUrl, patchSystemsFile, setAccount, } from './accounts-vault.js';
import { registerBundledSkill } from './skill.js';
import { clearLiveFocus, publishLiveFocus } from './live-focus.js';
/** Cordis plugin id. */
export const name = 'webclaw';
/** Tool registry must exist; skills are optional (deferred via ctx.inject). */
export const inject = ['tools'];
/** Validate plugin config from cordis.yml. */
export const Config = z.object({
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
        .array(z.object({
        id: z.string(),
        name: z.string().default(''),
        url: z.string(),
        username: z.string().default(''),
        password: z.string().default(''),
    }))
        .default([]),
    accountsUi: z.boolean().default(true),
    accountsUiPort: z.number().min(1).max(65_535).default(ACCOUNTS_UI_DEFAULT_PORT),
});
/**
 * Prefill local vault site entries from deploy config (url + optional credentials).
 */
async function ensureConfiguredSystems(config, ensured, log) {
    const entries = config.systems ?? [];
    if (entries.length === 0) {
        log.warn('webclaw: config.systems empty — vault overlay not applied');
        return;
    }
    const env = liteEnvFrom(config, ensured, 60_000);
    const home = env.webclawHome?.trim() || ensured.webclawHome;
    const normalized = entries
        .map(e => ({
        id: e.id?.trim() ?? '',
        name: e.name?.trim(),
        url: normalizeSystemUrl(e.url ?? ''),
        username: e.username?.trim() || '',
        password: e.password ?? '',
    }))
        .filter(e => e.id && e.url);
    // 1) Direct file write — reliable for `&` in URLs (no CLI/YAML truncation).
    try {
        const patched = patchSystemsFile(home, normalized.map(e => ({
            id: e.id,
            url: e.url,
            name: e.name,
            username: e.username || undefined,
        })));
        log.info('webclaw: systems file patched %s → %s', patched.path, patched.updated.join('; ') || '(none)');
    }
    catch (error) {
        log.warn('webclaw: systems file patch failed: %s', error instanceof Error ? error.message : error);
    }
    // 2) URL ensure + optional credential set (encrypted by lite).
    for (const entry of normalized) {
        try {
            const result = await ensureAccount(env, {
                id: entry.id,
                url: entry.url,
                name: entry.name,
            });
            if (!result.ok) {
                log.warn('webclaw: accounts ensure failed id=%s: %s', entry.id, result.error);
                continue;
            }
            log.info('webclaw: accounts ensure ok id=%s url=%s', entry.id, entry.url);
            if (entry.username && entry.password) {
                const set = await setAccount(env, {
                    id: entry.id,
                    user: entry.username,
                    password: entry.password,
                    url: entry.url,
                    name: entry.name,
                });
                if (!set.ok) {
                    log.warn('webclaw: accounts set failed id=%s: %s', entry.id, set.error);
                }
                else {
                    log.info('webclaw: accounts set ok id=%s user=%s', entry.id, entry.username);
                }
            }
        }
        catch (error) {
            log.warn('webclaw: accounts ensure error id=%s: %s', entry.id, error instanceof Error ? error.message : error);
        }
    }
}
function formatParamForm(params) {
    const rows = params.map(p => {
        // Strip accidental verb glue from older clients (家中有事登录EHR系统).
        let value = p.value || '（空）';
        value = value.replace(/登录[\u4e00-\u9fffA-Za-z0-9_-]*$/u, '').trim() || value;
        return `- ${p.name}：${value}`;
    });
    return [
        '【运行前请先确认参数 — 下列是默认值，请用户快捷改完再跑】',
        '',
        '立刻把下表展示给用户（可编辑表 / 整表贴回均可），等他们确认或改完。',
        '不要静默用默认值开跑；不要跳过确认；不要逐项口头追问。',
        ...rows,
        '',
        '用户改完或明确说「用默认」后：再次 webclaw_run，paramsConfirmed=true，并传 params 对象（不要传 JSON 字符串），如 {"公司":"山西阳泉","月份":"2026-07"}。',
        '确认前禁止 paramsConfirmed=true。',
    ].join('\n');
}
/**
 * Prefer Host native ask-user UI so params are confirmed before the browser starts.
 * Each field offers the current default as a one-tap option; custom text overrides.
 * Skip / empty answers keep the offered default — never wipe to blank.
 */
async function confirmRecipeParamsWithUser(params, exec) {
    if (!askUserQuestions || params.length === 0) {
        return [...params];
    }
    const answered = await askUserQuestions({
        questions: params.map(p => {
            const def = (p.value || '').trim();
            const shown = def || '（空）';
            return {
                id: `webclaw-param:${p.name}`,
                header: '确认运行参数',
                question: p.name,
                detail: `默认值：${shown}。点选默认即可，或输入新值后确认。跳过=沿用默认（不会清空）。`,
                options: [{ label: shown, description: def ? '使用默认值' : '保持为空' }],
            };
        }),
        agent: exec.agent,
        signal: exec.signal,
    });
    const byId = new Map(answered.answers.map(a => [a.id, a]));
    const anyReal = answered.answers.some(a => {
        const t = (a.custom?.trim() || a.selected?.[0]?.trim() || '').trim();
        return t !== '' && t !== '（空）';
    });
    // Whole-form skip / dismiss / empty picks → keep offered defaults (never wipe).
    if (!anyReal) {
        return [...params];
    }
    const next = [];
    for (const p of params) {
        const row = byId.get(`webclaw-param:${p.name}`);
        if (!row) {
            next.push({ name: p.name, value: p.value });
            continue;
        }
        const picked = (row.custom?.trim() || row.selected?.[0]?.trim() || '').trim();
        if (picked === '取消' || /^cancel$/i.test(picked)) {
            return 'cancelled';
        }
        // Empty / skip for this field → keep prior default, do not blank it out.
        if (!picked) {
            next.push({ name: p.name, value: p.value });
            continue;
        }
        const value = picked === '（空）' ? '' : picked;
        next.push({ name: p.name, value });
    }
    return next;
}
/** Plain JSON rows for tool results (dsh-tools JsonValue). */
function paramsJson(params) {
    return params.map(p => ({ name: p.name, value: p.value }));
}
function recipesCfg(config) {
    return {
        recipesDir: config.recipesDir || undefined,
        recipesRel: config.recipesRel || 'recipes',
        webclawHome: config.webclawHome || undefined,
    };
}
/** Soft-bound when `@deepseek-ai/dsh-user-questions` is in the composition. */
let askUserQuestions = null;
/**
 * When ask-user UI is unavailable, require a prior needParams round-trip before
 * trusting `paramsConfirmed=true` (models otherwise skip the human).
 */
const pendingParamGates = new Map();
/**
 * Session-scoped values the human already confirmed. Survives recipe body
 * changes on failure→patch retries so we do not re-interview the same fields.
 */
const sessionConfirmedByName = new Map();
const SESSION_PARAM_TTL_MS = 2 * 60 * 60 * 1000;
let sessionConfirmedAt = 0;
function touchSessionParams() {
    if (sessionConfirmedAt && Date.now() - sessionConfirmedAt > SESSION_PARAM_TTL_MS) {
        sessionConfirmedByName.clear();
        sessionConfirmedAt = 0;
    }
}
function rememberConfirmedParams(params) {
    touchSessionParams();
    for (const p of params) {
        const name = p.name.trim();
        if (!name)
            continue;
        sessionConfirmedByName.set(name, p.value);
    }
    sessionConfirmedAt = Date.now();
}
function seedParamsFromSession(params, overrides) {
    touchSessionParams();
    return params.map(p => {
        const fromOverride = overrides?.[p.name];
        if (fromOverride != null && String(fromOverride).trim() !== '') {
            return { name: p.name, value: String(fromOverride) };
        }
        if (sessionConfirmedByName.has(p.name)) {
            return { name: p.name, value: sessionConfirmedByName.get(p.name) ?? '' };
        }
        return { name: p.name, value: p.value };
    });
}
/** Names not yet confirmed this session and not supplied via non-empty overrides. */
function paramsNeedingAsk(params, overrides) {
    touchSessionParams();
    return params.filter(p => {
        const fromOverride = overrides?.[p.name];
        if (fromOverride != null && String(fromOverride).trim() !== '')
            return false;
        return !sessionConfirmedByName.has(p.name);
    });
}
function paramGateKey(sourcePath, content) {
    if (sourcePath)
        return `path:${sourcePath}`;
    const head = content.slice(0, 120).replace(/\s+/g, ' ');
    return `body:${content.length}:${head}`;
}
function armParamGate(key) {
    pendingParamGates.set(key, Date.now());
    // Drop stale entries (1h).
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, at] of pendingParamGates) {
        if (at < cutoff)
            pendingParamGates.delete(k);
    }
}
function consumeParamGate(key) {
    if (!pendingParamGates.has(key))
        return false;
    pendingParamGates.delete(key);
    return true;
}
function logSoftHitlReady(ctx) {
    try {
        ctx.logger.info('webclaw: userQuestions bound — captcha HITL + recipe param confirm will ask the human in-chat');
    }
    catch {
        /* ignore */
    }
}
function writeHumanReplyText(runDir, text) {
    const human = join(runDir, 'human');
    mkdirSync(human, { recursive: true });
    writeFileSync(join(human, 'human_reply.txt'), `${text.trim()}\n`, 'utf8');
}
/**
 * Block the tool call on the native ask-user UI (not the LLM) until the human
 * types the captcha, then resume the parked lite process.
 */
async function resolveNeedHumanWithUser(result, opts) {
    let current = result;
    // Cap nested captcha loops (wrong human code → another NEED_HUMAN).
    for (let round = 0; round < 5; round++) {
        if (!(current.earlyHitl && current.needHuman)) {
            return finalizeRunResult(current, opts.finalizeCtx);
        }
        const nh = current.needHuman;
        const runDir = (current.run_dir || '').trim();
        const hint = typeof nh.hint === 'string' && nh.hint.trim()
            ? nh.hint.trim()
            : '请输入验证码';
        const image = (typeof nh.inbox_image === 'string' && nh.inbox_image) ||
            (typeof nh.image_path === 'string' && nh.image_path) ||
            '';
        if (!askUserQuestions) {
            // No UI channel — fall back to model-mediated NEED_HUMAN (previous behaviour).
            return finalizeRunResult(current, opts.finalizeCtx);
        }
        let code = '';
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
            });
            const row = answered.answers.find(a => a.id === 'webclaw-captcha') || answered.answers[0];
            code = (row?.custom?.trim() || row?.selected?.[0]?.trim() || '').trim();
        }
        catch {
            // User cancelled / no provider / aborted — surface NEED_HUMAN to the model.
            return finalizeRunResult(current, opts.finalizeCtx);
        }
        if (!code || code === '取消' || /^cancel$/i.test(code)) {
            if (runDir) {
                try {
                    const human = join(runDir, 'human');
                    mkdirSync(human, { recursive: true });
                    writeFileSync(join(human, 'human_reply.json'), '{"cancel":true}\n', 'utf8');
                }
                catch {
                    /* ignore */
                }
            }
            cancelActiveHitl(opts.home);
            return {
                ok: false,
                cancelled: true,
                code: 'RUN_CANCELLED',
                error: '用户取消了验证码输入',
                run_dir: runDir,
                recipePath: opts.finalizeCtx.path,
                params: opts.finalizeCtx.mergedParams,
            };
        }
        if (runDir) {
            writeHumanReplyText(runDir, code);
        }
        else {
            // Fallback CLI when run_dir missing.
            await runLite(opts.lite, ['human-reply', '--text', code], {
                signal: opts.exec.signal,
            });
        }
        const continued = await resumeActiveHitl({
            signal: opts.exec.signal,
            earlyHitl: true,
        });
        if (!continued) {
            return {
                ok: true,
                note: 'captcha reply written; parked run already finished',
                run_dir: runDir,
                recipePath: opts.finalizeCtx.path,
                params: opts.finalizeCtx.mergedParams,
            };
        }
        if (continued.run_dir) {
            void publishLiveFocus(opts.home, continued.run_dir);
        }
        current = continued;
    }
    return finalizeRunResult(current, opts.finalizeCtx);
}
function finalizeRunResult(result, ctx) {
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
        };
    }
    if (result.earlyHitl && result.needHuman) {
        const nh = result.needHuman;
        const hint = typeof nh.hint === 'string' && nh.hint.trim()
            ? nh.hint.trim()
            : '需要验证码或人机确认';
        const image = (typeof nh.inbox_image === 'string' && nh.inbox_image) ||
            (typeof nh.image_path === 'string' && nh.image_path) ||
            '';
        return {
            ok: false,
            needHuman: true,
            code: 'NEED_HUMAN',
            error: 'NEED_HUMAN：必须立刻向用户展示验证码图并索要字符，禁止自行猜测/空等/只说「请查看浏览器」。拿到字符后调用 webclaw_human_reply(mode="text", text=用户输入, run_dir=本字段)。禁止在未询问用户的情况下继续其它工具。',
            hint,
            kind: typeof nh.kind === 'string' ? nh.kind : 'captcha',
            prompt_id: typeof nh.prompt_id === 'string' ? nh.prompt_id : '',
            image_path: image,
            run_dir: result.run_dir || '',
            eventsTail: redactSecrets(result.stdout.slice(-4000)),
            recipePath: ctx.path,
            params: ctx.mergedParams,
        };
    }
    const done = parseDoneEvent(result.stdout);
    const ok = done != null
        ? done.ok === true && (result.code === 0 || result.code == null)
        : result.code === 0;
    const errorText = done?.error ||
        (ok
            ? ''
            : (result.stderr ||
                (done
                    ? `run failed (ok=${done.okCount ?? '?'}, fail=${done.fail ?? '?'})`
                    : 'run failed: no done event')).slice(0, 500));
    const needsCredHint = !ok &&
        ctx.missingCreds.length > 0 &&
        /账号|密码|网站账号|凭据/u.test(errorText);
    return {
        ok,
        exitCode: result.code ?? -1,
        okCount: done?.okCount ?? null,
        fail: done?.fail ?? null,
        run_dir: done?.run_dir || result.run_dir || '',
        params: ctx.mergedParams,
        ...(ctx.missingCreds.length > 0
            ? { missingCredentials: [...ctx.missingCreds] }
            : {}),
        ...(needsCredHint ? { setupHint: CREDENTIALS_SETUP_HINT } : {}),
        error: errorText,
        eventsTail: redactSecrets(result.stdout.slice(-8000)),
        recipePath: ctx.path,
    };
}
function liteEnvFrom(config, ensured, timeoutMs) {
    return {
        binaryPath: ensured?.binaryPath ?? resolveBinaryPath(config),
        webclawHome: ensured?.webclawHome ?? resolveWebclawHome(config),
        liteBaseUrl: ensured?.liteBaseUrl ?? resolveLiteBaseUrl(config),
        timeoutMs: timeoutMs ?? config.runTimeoutMs,
    };
}
function parseJsonObject(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start)
        return undefined;
    try {
        return JSON.parse(text.slice(start, end + 1));
    }
    catch {
        return undefined;
    }
}
/**
 * Register webclaw tools and optional skill; optionally ensure lite at boot.
 */
export function apply(ctx, config) {
    if (config.registerSkill) {
        // Wait for skills without hard-requiring it in `inject` (keeps tools usable alone).
        ctx.inject(['skills'], skillCtx => {
            registerBundledSkill(skillCtx);
        });
    }
    // Soft: when user-questions UI is present, captcha HITL asks the human in-chat
    // instead of relying on the model to call webclaw_human_reply.
    ctx.inject(['userQuestions'], (scope) => {
        const ask = scope.userQuestions?.ask?.bind(scope.userQuestions);
        if (!ask)
            return () => undefined;
        askUserQuestions = ask;
        logSoftHitlReady(ctx);
        return () => {
            askUserQuestions = null;
        };
    });
    const log = {
        info: (msg, ...args) => ctx.logger.info(msg, ...args),
        warn: (msg, ...args) => ctx.logger.warn(msg, ...args),
    };
    let lastEnsure;
    let accountsUi = null;
    const ready = async () => {
        lastEnsure = await ensureLite(config, log);
        try {
            await startUi(lastEnsure);
        }
        catch (error) {
            log.warn('webclaw: accounts UI start failed: %s', error instanceof Error ? error.message : error);
        }
        return lastEnsure;
    };
    const env = async (timeoutMs) => {
        const ensured = await ready();
        return liteEnvFrom(config, ensured, timeoutMs);
    };
    const startUi = async (ensured) => {
        if (accountsUi || !config.accountsUi)
            return;
        // Use the already-resolved lite env — do not call ready()/env() (re-entrancy).
        accountsUi = await startAccountsUiServer({
            enabled: config.accountsUi,
            preferredPort: config.accountsUiPort || ACCOUNTS_UI_DEFAULT_PORT,
            getEnv: async () => liteEnvFrom(config, ensured, 60_000),
            home: ensured.webclawHome,
            binaryPath: ensured.binaryPath,
            log,
        });
    };
    ctx.effect(() => {
        return () => {
            const home = resolveWebclawHome({ webclawHome: config.webclawHome });
            try {
                clearLiveFocus(home);
            }
            catch {
                /* best-effort */
            }
            accountsUi?.clearFocus();
            accountsUi?.close();
            accountsUi = null;
            // CDP Chrome is detached from the Host process — stop it on Host teardown.
            const ensured = lastEnsure;
            if (ensured) {
                void runLite(liteEnvFrom(config, ensured, 15_000), ['browser', 'stop']).catch(() => {
                    /* best-effort; desktop shutdown also reclaims 19222 */
                });
            }
        };
    }, 'webclaw: accounts UI lifetime');
    if (config.ensureOnBoot || (config.systems?.length ?? 0) > 0 || config.accountsUi) {
        void ready()
            .then(async (r) => {
            ctx.logger.info('webclaw: ensureOnBoot ok (downloaded=%s path=%s)', String(r.downloaded), r.binaryPath);
            await ensureConfiguredSystems(config, r, log);
            await startUi(r);
        })
            .catch((error) => {
            ctx.logger.warn('webclaw: ensureOnBoot failed: %s', error instanceof Error ? error.message : error);
        });
    }
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_status',
        description: 'Check local webclaw-lite readiness (Chrome path, product, chromeOk). Prefer this before run when unsure the CLI is installed. On Windows / macOS, missing lite is auto-downloaded from GitHub Releases.',
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
        async execute(args) {
            let ensured;
            try {
                ensured = await ready();
            }
            catch (error) {
                return {
                    ok: false,
                    product: 'webclaw-lite',
                    error: error instanceof Error ? error.message : String(error),
                    binaryPath: resolveBinaryPath(config),
                };
            }
            const argv = ['status'];
            if (args.run_id?.trim()) {
                argv.push('--run-id', args.run_id.trim());
            }
            const result = await runLite(liteEnvFrom(config, ensured), argv);
            const text = `${result.stdout}\n${result.stderr}`.trim();
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            let status = {
                ok: false,
                exitCode: result.code,
                raw: text.slice(0, 2000),
            };
            if (start >= 0 && end > start) {
                try {
                    status = JSON.parse(text.slice(start, end + 1));
                }
                catch {
                    /* keep raw */
                }
            }
            status.exitCode = result.code ?? -1;
            status.binaryPath = ensured.binaryPath;
            return status;
        },
    })), 'webclaw: tool webclaw_status');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_run',
        description: 'PRIMARY tool for browser RPA. User phrases 打开/点击/输入/等待/采集/登录 are recipe VERBS — call this with a Chinese recipe string (e.g. recipe="打开旧MES系统" or "打开https://a.com，等待5，采集表格"). Do NOT stop after accounts lookup. NEVER open via Start-Process / default browser. Full/frozen recipe → ONE call (prefer recipePath). KEEP 参数名=值 / {{名}} — never expand defaults into the body before run. Host confirms params once per session; on failure→patch retry REUSE the same params (paramsConfirmed=true + params object) — do NOT re-ask or blank them. Probe steps: keep `(点击取消?)` / `（点击已有项？点击新建）` literally — runtime try/skip-or-fallback; NEVER strip parentheses+?. Ask early on failure: ONE cheap short patch; control-not-found / download pending=0 → STOP and ask. Agent download waits: 等待下载30/60. No CSS/Playwright. Agent second-waits: ONLY 等待2/等待5.',
        parameters: {
            recipe: {
                type: 'string',
                description: 'Inline Chinese recipe using verbs 打开/登录/点击/输入/等待/采集… joined by ，. Example: 登录旧MES系统，等待5  or  点击保存，等待2. Agent may ONLY use 等待{秒数}; do not invent wait text/targets. User saying「打开MES」→ put that verb into this field and run. Mutually exclusive with recipePath.',
            },
            recipePath: {
                type: 'string',
                description: 'Path to .webclaw file: workspace-relative, recipes/<name>, absolute, or attachment read path. Prefer this when a frozen/uploaded file already exists.',
            },
            title: {
                type: 'string',
                description: 'Optional run title',
            },
            // Loose schema: models pass object or JSON string; Host parses both.
            // Must declare type — typeless params make defineTool abort the whole fiber.
            params: {
                type: 'json',
                description: 'Param overrides. Prefer object {"休假项目":"年假",...}; JSON string also ok.',
            },
            paramsConfirmed: {
                type: 'boolean',
                description: 'Set true only after the user confirmed/edited params (or Host already collected them via ask-user). Never set true to skip first confirmation. When Host has userQuestions, interactive confirm runs anyway before the browser starts.',
            },
            headless: {
                type: 'boolean',
                description: 'Optional one-shot only. Prefer webclaw_set_display for sticky takeover. After user 接管 (display.json headless=false), OMIT this so later runs stay headed until user asks for 无头.',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = value;
                if (v.needParams && v.form) {
                    return [{ type: 'text', text: v.form }];
                }
                if (v.needHuman) {
                    const blocks = [{
                            type: 'text',
                            text: [
                                'webclaw_run: NEED_HUMAN（请立刻把验证码图给用户看，并索要字符）',
                                v.hint ? `hint: ${v.hint}` : '',
                                v.image_path ? `image: ${v.image_path}` : '',
                                v.run_dir ? `run_dir: ${v.run_dir}` : '',
                                '下一步：展示图片 → 用户回字符 → webclaw_human_reply(mode=text, text=…, run_dir=…)',
                            ].filter(Boolean).join('\n'),
                        }];
                    if (v.image_path) {
                        try {
                            const bytes = readFileSync(v.image_path);
                            blocks.push({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/png',
                                    data: bytes.toString('base64'),
                                },
                            });
                        }
                        catch {
                            /* path may be unavailable; text path remains */
                        }
                    }
                    return blocks;
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
                ].filter(Boolean);
                return [{ type: 'text', text: lines.join('\n') }];
            },
        },
        async execute(args, exec) {
            const inline = args.recipe?.trim() ?? '';
            const pathArg = args.recipePath?.trim() ?? '';
            if (inline && pathArg) {
                throw new Error('pass either recipe or recipePath, not both');
            }
            if (!inline && !pathArg) {
                throw new Error('recipe or recipePath is required');
            }
            const cwd = agentCwd(exec);
            const sourcePath = pathArg
                ? resolveRecipePath(recipesCfg(config), pathArg, cwd)
                : undefined;
            const rawContent = sanitizeWebclawRecipe(inline
                ? inline
                : readFileSync(sourcePath, { encoding: 'utf8' }));
            const declared = extractRecipeParams(rawContent);
            // Tool schema may deliver object or string; parseParamsArg accepts both.
            let overrides = parseParamsArg(args.params);
            const confirmed = args.paramsConfirmed === true;
            // Gate on 参数…= / {{名}} / tool params — not only explicit 参数 lines
            // (models often expand defaults into the body and skip confirm).
            const confirmable = collectConfirmableParams(rawContent, overrides);
            const gateKey = paramGateKey(sourcePath, rawContent);
            if (config.requireParamConfirm && confirmable.length > 0) {
                const preview = applyParamOverrides(rawContent, overrides);
                // Prefer confirmable list (includes mustache / params-arg keys).
                const baseParams = preview.params.length >= confirmable.length
                    ? preview.params
                    : confirmable.map(p => {
                        const hit = preview.params.find(x => x.name === p.name);
                        return hit ?? p;
                    });
                // Seed from this-session human confirms so failure→patch retries
                // do not re-interview fields the user already filled.
                const previewParams = seedParamsFromSession(baseParams, overrides);
                const needAsk = paramsNeedingAsk(previewParams, overrides);
                if (askUserQuestions) {
                    let picked = previewParams;
                    if (needAsk.length === 0) {
                        // All fields known from session and/or non-empty tool params.
                        rememberConfirmedParams(previewParams);
                    }
                    else {
                        try {
                            const answered = await confirmRecipeParamsWithUser(needAsk.length < previewParams.length ? needAsk : previewParams, exec);
                            if (answered === 'cancelled') {
                                return {
                                    ok: false,
                                    cancelled: true,
                                    code: 'PARAMS_CANCELLED',
                                    error: '用户取消了参数确认',
                                    params: paramsJson(previewParams),
                                    recipePath: sourcePath ?? '',
                                };
                            }
                            const byName = new Map(previewParams.map(p => [p.name, p.value]));
                            for (const p of answered)
                                byName.set(p.name, p.value);
                            picked = previewParams.map(p => ({
                                name: p.name,
                                value: byName.get(p.name) ?? p.value,
                            }));
                            rememberConfirmedParams(picked);
                        }
                        catch {
                            // UI cancelled / unavailable — fall back to model-mediated form
                            // unless a prior needParams gate was armed + paramsConfirmed,
                            // or session already filled every field.
                            if (needAsk.length > 0 && (!confirmed || !consumeParamGate(gateKey))) {
                                armParamGate(gateKey);
                                return {
                                    ok: false,
                                    needParams: true,
                                    params: paramsJson(previewParams),
                                    form: formatParamForm(previewParams),
                                    error: 'needParams: show the editable param table once; wait for user edits; do not start the browser yet',
                                    recipePath: sourcePath ?? '',
                                };
                            }
                            picked = previewParams;
                            rememberConfirmedParams(picked);
                        }
                    }
                    overrides = Object.fromEntries(picked.map(p => [p.name, p.value]));
                    pendingParamGates.delete(gateKey);
                }
                else if (needAsk.length > 0 && (!confirmed || !consumeParamGate(gateKey))) {
                    armParamGate(gateKey);
                    return {
                        ok: false,
                        needParams: true,
                        params: paramsJson(previewParams),
                        form: formatParamForm(previewParams),
                        error: 'needParams: show the editable param table once; wait for user edits (not verbal interview); do not start the browser yet',
                        recipePath: sourcePath ?? '',
                    };
                }
                else {
                    // Session / tool params already cover every field.
                    rememberConfirmedParams(previewParams);
                    overrides = Object.fromEntries(previewParams.map(p => [p.name, p.value]));
                }
            }
            const merged = applyParamOverrides(rawContent, overrides);
            // Soft status only — never block open for missing password (SSO / session OK).
            const lite = await env();
            // Re-apply deploy systems (URL + optional test credentials).
            if ((config.systems?.length ?? 0) > 0) {
                const ensured = await ready();
                await ensureConfiguredSystems(config, ensured, log);
            }
            const listed = await listAccounts(lite);
            const missingCreds = missingCredentialsForRecipe(merged.content, listed.items);
            const path = confirmable.length > 0 || declared.length > 0 || overrides
                ? writeTempRecipe(merged.content)
                : sourcePath ?? writeTempRecipe(rawContent);
            const argv = ['run', '--recipe', path];
            if (args.title?.trim()) {
                argv.push('--title', args.title.trim());
            }
            const headlessArg = args.headless;
            if (headlessArg === true)
                argv.push('--headless');
            else if (headlessArg === false)
                argv.push('--headed');
            const home = resolveWebclawHome({ webclawHome: config.webclawHome });
            // Host Stop aborts exec.signal → cancel marker + kill. earlyHitl returns
            // on captcha so the agent can ask the user (OCR already tried submit).
            const result = await runLite(lite, argv, {
                signal: exec.signal,
                earlyHitl: true,
                onRunDir: dir => {
                    void publishLiveFocus(home, dir);
                },
            });
            if (result.run_dir) {
                void publishLiveFocus(home, result.run_dir);
            }
            const finalizeCtx = {
                path,
                mergedParams: paramsJson(merged.params),
                missingCreds,
            };
            if (result.earlyHitl && result.needHuman) {
                return resolveNeedHumanWithUser(result, {
                    home,
                    lite,
                    exec,
                    finalizeCtx,
                });
            }
            return finalizeRunResult(result, finalizeCtx);
        },
    })), 'webclaw: tool webclaw_run');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_set_display',
        description: 'Persist sticky Chrome display mode to display.json and IMMEDIATELY restart Chrome in that mode so the window appears (or hides). User「接管/我来点/弹出浏览器/改成有头」→ headless=false and KEEP headed until user explicitly says「隐藏浏览器/改成无头」→ headless=true. Do not auto-revert after runs. Mode switch recycles Chrome (current page may reset; cookies usually kept). Default product mode is headless.',
        parameters: {
            headless: {
                type: 'boolean',
                required: true,
                description: 'true = hide browser (headless); false = show Chrome window for user takeover. Sticky until changed again.',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
                { type: 'text', text: JSON.stringify(value, null, 2) },
            ],
        },
        async execute(args) {
            const headless = args.headless === true;
            const argv = ['display', '--headless', headless ? '1' : '0'];
            const ensured = await ready();
            const result = await runLite(liteEnvFrom(config, ensured, 15_000), argv);
            const text = `${result.stdout}\n${result.stderr}`.trim();
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text);
            if (parsed) {
                return {
                    ...parsed,
                    ok: parsed.ok !== false && (result.code === 0 || result.code == null),
                    exitCode: result.code ?? -1,
                };
            }
            return {
                ok: result.code === 0,
                exitCode: result.code ?? -1,
                headless,
                raw: text.slice(0, 2000),
            };
        },
    })), 'webclaw: tool webclaw_set_display');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_browser',
        description: 'Control the local webclaw Chrome/CDP instance. User「关掉浏览器/关掉实例/释放浏览器」→ action=stop. status = port/cdpReady/pid; restart = kill+relaunch. NEVER use PowerShell / taskkill / Stop-Process / kill / Start-Process — only this tool. Headless Chrome stays up by design after runs; call stop to free it. Next webclaw_run will launch again.',
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
        async execute(args) {
            const action = String(args.action ?? '')
                .trim()
                .toLowerCase();
            if (!['status', 'stop', 'restart'].includes(action)) {
                throw new Error('action must be status | stop | restart');
            }
            const ensured = await ready();
            const lite = liteEnvFrom(config, ensured, 60_000);
            const home = resolveWebclawHome({ webclawHome: config.webclawHome });
            let cancelNote;
            if (action === 'stop' || action === 'restart') {
                try {
                    const hitlCancelled = cancelActiveHitl(home);
                    writeCancelMarker(home);
                    const cancelResult = await runLite(lite, ['cancel']);
                    cancelNote = {
                        hitlCancelled,
                        cancelExitCode: cancelResult.code ?? -1,
                    };
                }
                catch (e) {
                    cancelNote = {
                        cancelError: String(e?.message || e).slice(0, 300),
                    };
                }
            }
            const result = await runLite(lite, ['browser', action]);
            const text = `${result.stdout}\n${result.stderr}`.trim();
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text);
            if (parsed) {
                return {
                    ...parsed,
                    ok: parsed.ok !== false && (result.code === 0 || result.code == null),
                    exitCode: result.code ?? -1,
                    ...(cancelNote ? { cancel: cancelNote } : {}),
                };
            }
            return {
                ok: result.code === 0,
                exitCode: result.code ?? -1,
                action,
                raw: text.slice(0, 2000),
                ...(cancelNote ? { cancel: cancelNote } : {}),
            };
        },
    })), 'webclaw: tool webclaw_browser');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_accounts_status',
        description: 'LOOKUP ONLY: list local vault sites (id/name/url/username/has_password — NEVER passwords). Does NOT open a browser. After finding a site (e.g. 旧MES), you MUST still call webclaw_run with a recipe verb like 打开旧MES系统 / 登录旧MES系统. SSO URLs need NO password. Never ask for passwords or invent accounts-set CLI.',
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
                ];
            },
        },
        async execute() {
            const ensured = await ready();
            if ((config.systems?.length ?? 0) > 0) {
                await ensureConfiguredSystems(config, ensured, log);
            }
            const listed = await listAccounts(liteEnvFrom(config, ensured));
            const needsUrl = listed.items.filter(it => !it.url.trim());
            const needsSsoUrl = listed.items.filter(it => !!it.url.trim() &&
                !isSsoAccountUrl(it.url) &&
                /hcmcloud|\behr\b/i.test(`${it.id} ${it.name} ${it.url}`));
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
                setupHint: needsUrl.length > 0
                    ? CREDENTIALS_SETUP_HINT
                    : needsSsoUrl.length > 0
                        ? 'EHR URL missing sso=lark — user should fix 设置 → 网站账号 URL only. Never ask for passwords or invent accounts set CLI.'
                        : 'OK to webclaw_run. Never ask for passwords or invent accounts set CLI.',
                error: listed.error || '',
                binaryPath: ensured.binaryPath,
            };
        },
    })), 'webclaw: tool webclaw_accounts_status');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_inspect_params',
        description: 'Extract editable 参数名=值 fields from a recipe. Prefer letting webclaw_run return needParams. Show table once for user to edit; then webclaw_run with paramsConfirmed=true + params JSON. Do not interview field-by-field.',
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
                const v = value;
                if (v.form)
                    return [{ type: 'text', text: v.form }];
                if (v.error)
                    return [{ type: 'text', text: v.error }];
                return [
                    {
                        type: 'text',
                        text: JSON.stringify(v.params ?? [], null, 2),
                    },
                ];
            },
        },
        async execute(args, exec) {
            const inline = args.recipe?.trim() ?? '';
            const pathArg = args.recipePath?.trim() ?? '';
            if (inline && pathArg) {
                throw new Error('pass either recipe or recipePath, not both');
            }
            if (!inline && !pathArg) {
                throw new Error('recipe or recipePath is required');
            }
            const cwd = agentCwd(exec);
            const content = sanitizeWebclawRecipe(inline
                ? inline
                : readFileSync(resolveRecipePath(recipesCfg(config), pathArg, cwd), { encoding: 'utf8' }));
            const params = extractRecipeParams(content);
            return {
                ok: true,
                params: paramsJson(params),
                form: params.length > 0
                    ? formatParamForm(params)
                    : '（该菜谱没有「参数」声明，可直接 webclaw_run）',
                hint: params.length > 0
                    ? 'Show editable table once; after user edits → webclaw_run(..., paramsConfirmed=true, params={...})'
                    : 'No static params; run directly',
            };
        },
    })), 'webclaw: tool webclaw_inspect_params');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_freeze',
        description: 'LOCAL freeze only: write a COMPLETE updated recipe as UTF-8 recipes/<name>.webclaw. On DSH/蜂行, skill body is primary — any save_skill (update/asCopy) or freeze requires explicit user consent; never silent/default persist after a successful run. Prefer showing the recipe in chat first. Replay with webclaw_run(recipePath).',
        parameters: {
            name: {
                type: 'string',
                required: true,
                description: 'Recipe stem (becomes <name>.webclaw). Local library only — not a substitute for updating/copying a DSH skill.',
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
                const v = value;
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
                ];
            },
        },
        async execute(args, exec) {
            const saved = freezeRecipe({
                config: recipesCfg(config),
                name: args.name,
                recipe: args.recipe,
                title: args.title,
                cwd: agentCwd(exec),
            });
            return {
                ok: true,
                ...saved,
                hint: 'Open this path in Files for plain-text preview; edit via open-in-app or fs tools; replay with webclaw_run(recipePath).',
            };
        },
    })), 'webclaw: tool webclaw_freeze');
    ctx.effect(() => ctx.tools.register(defineTool({
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
            const listed = listRecipes(recipesCfg(config), agentCwd(exec));
            return { type: 'recipes', ...listed };
        },
    })), 'webclaw: tool webclaw_list_recipes');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_import',
        description: 'Copy an existing .webclaw (attachment path or any file) into the recipes library for durable replay/edit. Prefer this over treating chat attachments as the long-term store.',
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
            });
            return {
                ok: true,
                ...saved,
                hint: 'Imported into recipes library. Preview in Files; replay with webclaw_run(recipePath).',
            };
        },
    })), 'webclaw: tool webclaw_import');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_probe',
        description: 'The only allowed “eyes” for page structure. Authoring-only when NO complete recipe exists yet: scan the page (or open url) and return textCmd/indexCmd/clickCmd/inputCmd. After a failed full run, at most ONE probe then edit+rerun once; if still stuck, stop and ask the user. NEVER use PowerShell/raw CDP/WebSocket scripts as a substitute. NEVER call if the user already gave a full recipe/recipePath—use webclaw_run once instead. Do not invent labels.',
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
                const v = value;
                const head = [
                    v.ok === false ? 'webclaw_probe: failed' : 'webclaw_probe: ok',
                    v.url ? `url: ${v.url}` : '',
                    typeof v.candidateCount === 'number'
                        ? `candidates: ${v.candidateCount}`
                        : '',
                    v.hint || '',
                ].filter(Boolean);
                const sample = Array.isArray(v.candidates)
                    ? v.candidates.slice(0, 12)
                    : [];
                return [
                    {
                        type: 'text',
                        text: `${head.join('\n')}\n${JSON.stringify(sample, null, 2)}`,
                    },
                ];
            },
        },
        async execute(args) {
            const argv = ['probe'];
            if (args.url?.trim()) {
                argv.push('--url', args.url.trim());
            }
            if (args.types?.trim()) {
                argv.push('--types', args.types.trim());
            }
            if (args.search?.trim()) {
                argv.push('--search', args.search.trim());
            }
            if (typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0) {
                argv.push('--limit', String(Math.floor(args.limit)));
            }
            const ensured = await ready();
            const result = await runLite(liteEnvFrom(config, ensured, config.probeTimeoutMs), argv);
            const text = `${result.stdout}\n${result.stderr}`.trim();
            const parsed = parseJsonObject(result.stdout) ?? parseJsonObject(text);
            if (parsed && parsed.type === 'probe') {
                Object.assign(parsed, {
                    exitCode: result.code ?? -1,
                    binaryPath: ensured.binaryPath,
                });
                return parsed;
            }
            return {
                type: 'probe',
                ok: false,
                exitCode: result.code ?? -1,
                error: (result.stderr || result.stdout || 'probe failed').slice(0, 500),
                raw: text.slice(0, 2000),
                binaryPath: ensured.binaryPath,
            };
        },
    })), 'webclaw: tool webclaw_probe');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_human_reply',
        description: 'Resume a NEED_HUMAN pause after OCR failed or captcha still present. Pass user-supplied captcha (mode=text) or slider ok. Then waits for run to finish or next NEED_HUMAN. Do not leave the user waiting — ask for the code as soon as NEED_HUMAN returns.',
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
            const mode = args.mode.trim().toLowerCase();
            const argv = ['human-reply'];
            if (mode === 'ok')
                argv.push('--ok');
            else if (mode === 'cancel')
                argv.push('--cancel');
            else if (mode === 'text') {
                if (!args.text?.trim())
                    throw new Error('text required when mode=text');
                argv.push('--text', args.text.trim());
            }
            else {
                throw new Error('mode must be text|ok|cancel');
            }
            if (args.run_dir?.trim()) {
                argv.push('--run-dir', args.run_dir.trim());
            }
            const lite = await env();
            const ack = await runLite(lite, argv, { signal: exec.signal });
            if (ack.code !== 0 && ack.code != null) {
                return {
                    ok: false,
                    exitCode: ack.code,
                    error: (ack.stderr || ack.stdout || 'human-reply failed').slice(0, 500),
                };
            }
            if (!hasActiveHitl()) {
                return {
                    ok: true,
                    exitCode: 0,
                    note: 'reply written; no parked run (lite may already have continued)',
                    stdout: ack.stdout.trim().slice(0, 1000),
                };
            }
            const continued = await resumeActiveHitl({
                signal: exec.signal,
                earlyHitl: true,
            });
            if (!continued) {
                return { ok: true, exitCode: 0, note: 'reply written' };
            }
            return finalizeRunResult(continued, {
                path: args.run_dir?.trim() || '',
                mergedParams: [],
                missingCreds: [],
            });
        },
    })), 'webclaw: tool webclaw_human_reply');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'webclaw_cancel',
        description: 'Stop the current webclaw-lite run immediately (Host Stop should also abort the in-flight webclaw_run). Writes control/cancel and kills the child.',
        parameters: {},
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [
                { type: 'text', text: JSON.stringify(value) },
            ],
        },
        async execute() {
            const lite = await env();
            const home = resolveWebclawHome({ webclawHome: config.webclawHome });
            const hitlCancelled = cancelActiveHitl(home);
            writeCancelMarker(home);
            const result = await runLite(lite, ['cancel']);
            return {
                ok: true,
                cancelled: true,
                hitlCancelled,
                exitCode: result.code ?? -1,
                stdout: result.stdout.trim().slice(0, 1000),
                stderr: result.stderr.trim().slice(0, 500),
            };
        },
    })), 'webclaw: tool webclaw_cancel');
}
