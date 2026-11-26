/**
 * Promote webclaw run deliverables into the DSH workspace `outputs/` folder
 * and best-effort mark them in Fengxing's library-artifact-index.json.
 *
 * Opt-in model:
 * - Always: downloads/ + files/ (browser downloads & attachments)
 * - Plus: paths listed in run_dir/library-manifest.jsonl (user「截图」、AI 报告、有行 CSV…)
 * - Never blind-scan documents/ or screenshots/ (failure dumps / 页面采集 md stay in run dir)
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
/** Exported for unit tests. */
export declare function isDeliverableFile(name: string): boolean;
/** Resolve manifest paths to absolute files still under runDir. Exported for tests. */
export declare function listManifestDeliverables(runDir: string): string[];
/** Collect paths to promote. Exported for unit tests. */
export declare function listPromoteSources(runDir: string): string[];
/**
 * Copy important run artifacts into `{cwd}/outputs/webclaw-…/` and mark for 资料库.
 * No-op when cwd/runDir missing or no deliverables. Never throws to callers.
 */
export declare function promoteRunDeliverables(opts: {
    readonly runDir?: string;
    readonly cwd?: string;
    readonly sessionId?: string;
}): PromoteOutputsResult;
