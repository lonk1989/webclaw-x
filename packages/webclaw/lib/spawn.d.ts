/**
 * Spawn webclaw-lite and capture stdout/stderr.
 *
 * Supports Host Stop (AbortSignal → cancel marker + kill) and early HITL
 * (return on need_human while keeping the child for human_reply resume).
 */
export interface SpawnResult {
    readonly code: number | null;
    readonly stdout: string;
    readonly stderr: string;
    /** True when resolved early on need_human; child still running until resume/cancel. */
    readonly earlyHitl?: boolean;
    readonly needHuman?: Record<string, unknown>;
    readonly run_dir?: string;
    readonly cancelled?: boolean;
}
export interface LiteEnv {
    readonly binaryPath: string;
    readonly webclawHome?: string;
    readonly liteBaseUrl?: string;
    readonly timeoutMs?: number;
}
export interface RunLiteOptions {
    readonly signal?: AbortSignal;
    /** Return on first need_human JSONL event; keep child for resume. Default true for run. */
    readonly earlyHitl?: boolean;
    /** Called once when run_dir first appears in JSONL (for live sidebar). */
    readonly onRunDir?: (runDir: string) => void;
    /**
     * Mirror JSONL log lines to control/live-log.json for the in-chat toolview.
     * Default true for `run` argv; false for status/probe/etc.
     */
    readonly liveLog?: boolean;
}
/** Write control/cancel so lite's AtomicBool polls pick it up quickly. */
export declare function writeCancelMarker(home: string): void;
/** Cancel in-flight early-HITL child (Host Stop / webclaw_cancel). */
export declare function cancelActiveHitl(home?: string): boolean;
/**
 * Run webclaw-lite with argv; merges WEBCLAW_* env.
 * Pass `signal` so Host Stop aborts the child; pass `earlyHitl:true` for captcha pause.
 */
export declare function runLite(env: LiteEnv, args: readonly string[], options?: RunLiteOptions): Promise<SpawnResult>;
/**
 * After webclaw_human_reply wrote the file, wait for the parked run to finish
 * (or hit another need_human).
 */
export declare function resumeActiveHitl(options?: RunLiteOptions): Promise<SpawnResult | null>;
export declare function hasActiveHitl(): boolean;
/**
 * Write a UTF-8 recipe file under the OS temp dir and return its path.
 */
export declare function writeTempRecipe(recipe: string): string;
/**
 * Parse the last JSONL `done` event from run stdout.
 *
 * lite emits `ok`/`fail` as **step counts** (u32), e.g.
 * `{"type":"done","ok":2,"fail":0,"run_dir":"..."}` — not a boolean.
 */
export declare function parseDoneEvent(stdout: string): {
    readonly ok: boolean;
    readonly okCount?: number;
    readonly fail?: number;
    readonly error?: string;
    readonly run_dir?: string;
} | undefined;
