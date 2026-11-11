/**
 * Detect whether the live Agent model accepts image input (DSH inputModalities).
 * Used to route: vision model → pass images; text-only → webclaw_ocr_image.
 */

export type VisionCapability = {
  /** True when inputModalities was resolved from the LLM registry. */
  known: boolean
  /** True when modalities explicitly include `image`. */
  supportsImage: boolean
  /**
   * Prefer local OCR for image understanding.
   * True when known text-only OR modalities unknown (avoid model image errors).
   */
  preferOcr: boolean
  provider: string
  model: string
  inputModalities: string[]
  source: 'assembled' | 'agent.options' | 'cache' | 'none'
  error?: string
}

type ModelRef = { provider: string; model: string; source: VisionCapability['source'] }

/** Per-agent last assembled provider/model (tracks UI model switches better than seed options). */
const assembledByAgent = new Map<string, { provider: string; model: string }>()

export function rememberAssembledModel(
  agentId: string | undefined,
  provider: unknown,
  model: unknown,
): void {
  const p = String(provider || '').trim()
  const m = String(model || '').trim()
  const id = String(agentId || '').trim()
  if (!id || !p || !m) return
  assembledByAgent.set(id, { provider: p, model: m })
}

function agentIdOf(agent: unknown): string {
  const a = agent as { id?: unknown } | null
  return a?.id != null ? String(a.id) : ''
}

function pickModelRef(agent: unknown): ModelRef | null {
  const id = agentIdOf(agent)
  const cached = id ? assembledByAgent.get(id) : undefined
  if (cached?.provider && cached?.model) {
    return { ...cached, source: 'cache' }
  }

  const a = agent as {
    options?: { provider?: unknown; model?: unknown }
    ctx?: { get?: (name: string) => unknown }
  } | null
  // Some hosts stash live selection on agent-scoped services.
  try {
    const sel = a?.ctx?.get?.('modelSelection') as
      | { current?: { provider?: string; model?: string }; assembled?: { provider?: string; model?: string } }
      | undefined
    const live = sel?.assembled || sel?.current
    if (live?.provider && live?.model) {
      return { provider: live.provider, model: live.model, source: 'assembled' }
    }
  } catch {
    /* optional */
  }

  const provider = String(a?.options?.provider || '').trim()
  const model = String(a?.options?.model || '').trim()
  if (provider && model) {
    return { provider, model, source: 'agent.options' }
  }
  return null
}

type LlmLike = {
  resolveModelInfo?: (
    provider: string,
    model: string,
    signal?: AbortSignal,
  ) => Promise<{ inputModalities?: readonly string[] }>
}

type HostLike = {
  /** Cordis Context.get — safe optional lookup (never touch `.llm` without inject). */
  get?: (name: string) => unknown
}

/**
 * Resolve llm via Context.get only. Reading `ctx.llm` without declaring
 * `inject: ['llm']` throws: cannot get property "llm" without inject.
 */
function llmOf(host: HostLike | null | undefined, agent?: unknown): LlmLike | null {
  const tryGet = (obj: unknown): LlmLike | null => {
    if (!obj || typeof obj !== 'object') return null
    const get = (obj as HostLike).get
    if (typeof get !== 'function') return null
    try {
      const v = get.call(obj, 'llm')
      return v && typeof v === 'object' ? (v as LlmLike) : null
    } catch {
      return null
    }
  }
  return (
    tryGet(host) ||
    tryGet((agent as { ctx?: unknown } | null)?.ctx) ||
    null
  )
}

/**
 * Resolve vision capability for the current tool execution's Agent.
 * @param host Cordis Context — use `.get('llm')`, never bare `.llm`
 * @param exec ToolRunContext-like `{ agent?, signal? }`
 */
export async function resolveVisionCapability(
  host: HostLike | null | undefined,
  exec?: { agent?: unknown; signal?: AbortSignal },
): Promise<VisionCapability> {
  const ref = pickModelRef(exec?.agent)
  if (!ref) {
    return {
      known: false,
      supportsImage: false,
      preferOcr: true,
      provider: '',
      model: '',
      inputModalities: [],
      source: 'none',
      error: 'no provider/model on agent',
    }
  }

  const llm = llmOf(host, exec?.agent)
  if (!llm?.resolveModelInfo) {
    return {
      known: false,
      supportsImage: false,
      preferOcr: true,
      provider: ref.provider,
      model: ref.model,
      inputModalities: [],
      source: ref.source,
      error: 'llm service unavailable',
    }
  }

  try {
    const info = await llm.resolveModelInfo(ref.provider, ref.model, exec?.signal)
    const mods = Array.isArray(info?.inputModalities)
      ? info.inputModalities.map(String)
      : undefined
    if (!mods) {
      // Absent modalities = unknown → prefer OCR to avoid attachment/runtime errors.
      return {
        known: false,
        supportsImage: false,
        preferOcr: true,
        provider: ref.provider,
        model: ref.model,
        inputModalities: [],
        source: ref.source,
      }
    }
    const supportsImage = mods.includes('image')
    return {
      known: true,
      supportsImage,
      preferOcr: !supportsImage,
      provider: ref.provider,
      model: ref.model,
      inputModalities: mods,
      source: ref.source,
    }
  } catch (e) {
    return {
      known: false,
      supportsImage: false,
      preferOcr: true,
      provider: ref.provider,
      model: ref.model,
      inputModalities: [],
      source: ref.source,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
