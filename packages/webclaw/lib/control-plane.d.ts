/**
 * Host control-plane helpers (parity with Python MCP jobs/status_fast):
 * busy / HITL / cancel marker / soft|hard reset — no lite spawn required for inspect.
 */
export type AgentPhase = 'idle' | 'running' | 'need_human' | 'busy' | 'cancelling' | 'cancelled' | 'done';
export interface NeedHumanSnap {
    readonly prompt_id?: string;
    readonly kind?: string;
    readonly hint?: string;
    readonly run_dir?: string;
    readonly inbox_image?: string;
    readonly image_path?: string;
}
export interface ActiveRunSnap {
    readonly id: string;
    readonly status: string;
    readonly startedAt?: string;
    readonly runDir?: string;
    readonly source: 'in_process' | 'jobs' | 'hitl_file';
}
export interface ControlPlaneSnapshot {
    readonly busy: boolean;
    readonly activeRun: ActiveRunSnap | null;
    readonly waitingHuman: boolean;
    readonly needHuman: NeedHumanSnap | null;
    readonly cancelMarkerPresent: boolean;
    /** Ghost HITL / cancel marker with no live child — agent should reset. */
    readonly orphanRisk: boolean;
}
export interface PreviewPaths {
    readonly runDir?: string;
    readonly livePreviewPath?: string;
    readonly captchaPath?: string;
}
export interface ResetResult {
    ok: boolean;
    code: string;
    message: string;
    before: ControlPlaneSnapshot;
    after: ControlPlaneSnapshot;
    actions: string[];
    hard: boolean;
    browserStopRequested: boolean;
}
/** Best-effort preview paths for agent/user visibility. */
export declare function previewPaths(home: string, runDir?: string | null): PreviewPaths;
/** Attach phase / userMessage / preview (Python MCP envelope parity). */
export declare function attachPhasePreview(result: Record<string, any>, opts: {
    phase: AgentPhase;
    userMessage: string;
    home: string;
    runDir?: string | null;
}): Record<string, any>;
/**
 * Snapshot busy / HITL / cancel without spawning lite.
 * Pass `inProcessBusy` from hasActiveHitl() when available.
 */
export declare function inspectControlPlane(home: string, opts?: {
    inProcessBusy?: boolean;
    activeRunDir?: string;
}): ControlPlaneSnapshot;
/** Remove orphan waiting_human.json (keep current live run_dir when in-process HITL). */
export declare function clearStaleHitlMarkers(home: string, keepRunDir?: string): string[];
export declare function clearCancelMarker(home: string): boolean;
/**
 * Abandon stuck runs: cancel in-process → clear jobs/markers/HITL orphans.
 * hard=true only signals browserStopRequested; caller runs browser stop.
 */
export declare function resetHome(home: string, opts?: {
    hard?: boolean;
}): ResetResult;
/** Merge control-plane fields onto a lite `status` JSON object. */
export declare function mergeStatusControlPlane(status: Record<string, any>, home: string): Record<string, any>;
