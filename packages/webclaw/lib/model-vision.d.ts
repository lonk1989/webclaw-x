/**
 * Detect whether the live Agent model accepts image input (DSH inputModalities).
 * Used to route: vision model → pass images; text-only → webclaw_ocr_image.
 */
export type VisionCapability = {
    /** True when inputModalities was resolved from the LLM registry. */
    known: boolean;
    /** True when modalities explicitly include `image`. */
    supportsImage: boolean;
    /**
     * Prefer local OCR for image understanding.
     * True when known text-only OR modalities unknown (avoid model image errors).
     */
    preferOcr: boolean;
    provider: string;
    model: string;
    inputModalities: string[];
    source: 'assembled' | 'agent.options' | 'cache' | 'none';
    error?: string;
};
export declare function rememberAssembledModel(agentId: string | undefined, provider: unknown, model: unknown): void;
type HostLike = {
    /** Cordis Context.get — safe optional lookup (never touch `.llm` without inject). */
    get?: (name: string) => unknown;
};
/**
 * Resolve vision capability for the current tool execution's Agent.
 * @param host Cordis Context — use `.get('llm')`, never bare `.llm`
 * @param exec ToolRunContext-like `{ agent?, signal? }`
 */
export declare function resolveVisionCapability(host: HostLike | null | undefined, exec?: {
    agent?: unknown;
    signal?: AbortSignal;
}): Promise<VisionCapability>;
export {};
