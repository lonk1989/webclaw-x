/**
 * @lonk1989/webclaw — recipe-level browser RPA for DeepSeek Harness.
 *
 * Registers task tools that spawn webclaw-lite. Does not claim ctx.browserUse.
 * On Windows / macOS, ensureOnBoot (default true) downloads lite from GitHub Releases.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin id. */
export declare const name = "webclaw";
/** Tool registry must exist; skills are optional (deferred via ctx.inject). */
export declare const inject: string[];
/** Deploy-time options for locating and invoking webclaw-lite. */
export interface Config {
    /**
     * Absolute path to webclaw-lite, or empty / `webclaw-lite` to use the managed
     * binary (auto-downloaded on Windows / macOS from GitHub Releases).
     * Windows: `%LOCALAPPDATA%/webclaw/bin/webclaw-lite.exe`
     * macOS: `~/.webclaw/bin/webclaw-lite`
     */
    binaryPath: string;
    /** Maps to WEBCLAW_HOME. */
    webclawHome: string;
    /**
     * Release directory prefix for download/update (no filename).
     * Empty → GitHub `…/releases/download/v{pluginVersion}`.
     */
    liteBaseUrl: string;
    /** When true, ensure lite at boot (download if missing). Default true. */
    ensureOnBoot: boolean;
    /** Register packaged SKILL.md. Default true. */
    registerSkill: boolean;
    /** Max ms for a single `webclaw_run` (default 10 minutes). */
    runTimeoutMs: number;
    /** Max ms for `webclaw_probe` (default 2 minutes). */
    probeTimeoutMs: number;
    /**
     * Absolute recipes library directory. When set, wins over workspace-relative.
     * Empty: use `{agent.cwd}/{recipesRel}` or `WEBCLAW_HOME/recipes`.
     */
    recipesDir: string;
    /** Relative recipes folder under session cwd (default `recipes`). */
    recipesRel: string;
    /**
     * When true (default), recipes that declare `参数名=值` refuse to run until
     * the model shows the param form and calls again with `paramsConfirmed=true`.
     */
    requireParamConfirm: boolean;
    /**
     * Private deploy overlay: seed local vault entries (id + name + login URL).
     * Optional username/password for private test accounts — applied via
     * `accounts set` (DPAPI) after lite is ready. Not for public OSS defaults.
     */
    systems: SystemEntryConfig[];
    /**
     * Start loopback accounts UI (127.0.0.1) for Settings form / browser page.
     * Default true. Passwords never enter the LLM.
     */
    accountsUi: boolean;
    /** Preferred loopback port for accounts UI (default 19229). */
    accountsUiPort: number;
}
/** One site entry for `config.systems` (private fork may include test credentials). */
export interface SystemEntryConfig {
    id: string;
    name?: string;
    url: string;
    /** Optional — private deploy test account only. */
    username?: string;
    /** Optional — private deploy test account only; never logged / never to LLM. */
    password?: string;
}
/** Validate plugin config from cordis.yml. */
export declare const Config: z<Partial<Config>, Config>;
/**
 * Register webclaw tools and optional skill; optionally ensure lite at boot.
 */
export declare function apply(ctx: Context, config: Config): void;
