/**
 * Bootstrap webclaw-lite from GitHub Releases (Windows x64 + macOS arm64/x64).
 * npm ships only the Cordis plugin; the native CLI is downloaded on demand.
 * Download tries config → official → env mirrors → built-in CN-friendly mirrors.
 */
/** npm package version — Release tag is `v${PLUGIN_VERSION}`. */
export declare const PLUGIN_VERSION: string;
export interface EnsureLiteConfig {
    readonly binaryPath: string;
    readonly webclawHome: string;
    /** Release directory prefix (no filename). Empty → multi-source default chain. */
    readonly liteBaseUrl: string;
}
export interface EnsureLiteResult {
    readonly binaryPath: string;
    readonly webclawHome: string;
    /** Base that succeeded (or preferred config/official when no download). */
    readonly liteBaseUrl: string;
    readonly downloaded: boolean;
}
export type EnsureLog = {
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
};
/**
 * Official GitHub Releases directory for this plugin version (no trailing slash).
 */
export declare function defaultLiteBaseUrl(version?: string): string;
/**
 * Release asset filename for the current host (or null if unsupported).
 * macOS x64 name is reserved even when CI only publishes arm64.
 */
export declare function releaseAssetName(platform?: NodeJS.Platform, arch?: NodeJS.Architecture): string | null;
/**
 * Candidate Release directory prefixes, ordered for try-in-order download.
 * Direct github.com is last so CN users hit ghfast.top first (avoids a long dead wait).
 * 1. config.liteBaseUrl when it is not github.com (self-hosted / CDN)
 * 2. WEBCLAW_LITE_MIRRORS (comma-separated release dirs or proxy prefixes)
 * 3. built-in mirrors (ghfast.top, then ghproxy) for each github primary
 * 4. github.com primaries (custom liteBaseUrl if github, then official)
 */
export declare function candidateLiteBaseUrls(config: EnsureLiteConfig): string[];
/**
 * Resolve WEBCLAW_HOME (config → env → %LOCALAPPDATA%/webclaw | ~/.webclaw).
 */
export declare function resolveWebclawHome(config?: EnsureLiteConfig | {
    readonly webclawHome?: string;
}): string;
/**
 * Managed install path for the lite CLI.
 */
export declare function managedBinaryPath(home: string): string;
/**
 * Whether config asks for the managed binary (auto-download eligible).
 */
export declare function usesManagedBinary(binaryPath: string): boolean;
/**
 * Effective binary path: managed home/bin or user override.
 */
export declare function resolveBinaryPath(config: EnsureLiteConfig): string;
/**
 * Preferred Release prefix when no download runs (config or official).
 */
export declare function resolveLiteBaseUrl(config: EnsureLiteConfig): string;
/**
 * Ensure webclaw-lite exists (download from Releases when using managed path).
 * Single-flight across concurrent tool calls.
 */
export declare function ensureLite(config: EnsureLiteConfig, log?: EnsureLog): Promise<EnsureLiteResult>;
