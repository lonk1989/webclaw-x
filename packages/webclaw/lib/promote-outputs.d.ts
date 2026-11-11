/**
 * Promote webclaw run deliverables into the DSH workspace `outputs/` folder
 * and best-effort mark them in Fengxing's library-artifact-index.json.
 *
 * Deliverables: downloads/ documents/ files/ (+ recipe screenshots/).
 * Not promoted: executions/, live-preview*, live-frames/, human/, README, temps.
 */
export interface PromotedOutput {
    readonly name: string;
    readonly path: string;
    readonly rel: string;
}
export interface PromoteOutputsResult {
    readonly workspaceDir?: string;
    readonly outputs: readonly PromotedOutput[];
    readonly marked: number;
    readonly skipped: number;
}
/** Resolve Fengxing dsh-home (same rules as corp-auth library.ts). */
export declare function resolveFengxingDshHome(): string;
/**
 * Copy important run artifacts into `{cwd}/outputs/webclaw-…/` and mark for 资料库.
 * No-op when cwd/runDir missing or no deliverables. Never throws to callers.
 */
export declare function promoteRunDeliverables(opts: {
    readonly runDir?: string;
    readonly cwd?: string;
    readonly sessionId?: string;
}): PromoteOutputsResult;
