/**
 * Local vault helpers via webclaw-lite accounts CLI (never for LLM tools that
 * accept passwords — Host UI / loopback server only).
 */
import { type LiteEnv } from './spawn.js';
export interface AccountStatus {
    id: string;
    name: string;
    url: string;
    username: string;
    has_password: boolean;
}
/** True when vault URL is SSO / OAuth — password is not required. */
export declare function isSsoAccountUrl(url: string): boolean;
export declare const CREDENTIALS_SETUP_HINT: string;
/**
 * Fix YAML / double-encoding: `\\u0026` → `&` so SSO query strings stay intact.
 */
export declare function normalizeSystemUrl(raw: string): string;
/**
 * Extract「登录…」targets from a recipe body (Chinese/ASCII commas).
 */
export declare function extractLoginQueries(content: string): string[];
/**
 * Soft status: missing vault URL for a login target.
 * SSO URLs without password are OK.
 */
export declare function missingCredentialsForRecipe(content: string, items: readonly AccountStatus[]): Array<{
    query: string;
    id: string;
    name: string;
    url: string;
    reason: string;
}>;
/** List vault entries (no password values). */
export declare function listAccounts(env: LiteEnv): Promise<{
    ok: boolean;
    items: AccountStatus[];
    error?: string;
}>;
/**
 * Write deploy `systems` URLs (and optional username) into WEBCLAW_HOME/web-systems.json.
 * Avoids CLI/`&` truncation and keeps Local source so login prefers overlay URLs.
 * Passwords are NOT written here — use `setAccount` so lite encrypts via DPAPI.
 */
export declare function patchSystemsFile(webclawHome: string, entries: readonly {
    id: string;
    url: string;
    name?: string;
    username?: string;
}[]): {
    ok: boolean;
    path: string;
    updated: string[];
};
/** Upsert URL/name without touching password. */
export declare function ensureAccount(env: LiteEnv, input: {
    id: string;
    url: string;
    name?: string;
}): Promise<{
    ok: boolean;
    item?: AccountStatus;
    error?: string;
}>;
/**
 * Write credentials. Empty password means "keep existing" — caller must omit
 * set when password blank and only URL/user changed (use ensure + set with
 * password only when nonempty).
 */
export declare function setAccount(env: LiteEnv, input: {
    id: string;
    user: string;
    password: string;
    url?: string;
    name?: string;
}): Promise<{
    ok: boolean;
    item?: AccountStatus;
    error?: string;
}>;
/** Save one site from the UI form. */
export declare function saveAccountFromForm(env: LiteEnv, input: {
    id: string;
    name?: string;
    url: string;
    username: string;
    password: string;
}): Promise<{
    ok: boolean;
    item?: AccountStatus;
    error?: string;
}>;
