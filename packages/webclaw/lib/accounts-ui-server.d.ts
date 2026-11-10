/**
 * Loopback-only HTTP UI for site accounts.
 *
 * Bound to 127.0.0.1 — passwords never leave the machine or enter the LLM.
 * DSH Client (when isLoopback) and the desktop browser launcher both use this.
 */
import type { LiteEnv } from './spawn.js';
/** Default port (near CDP 19222); falls back to ephemeral if busy. */
export declare const ACCOUNTS_UI_DEFAULT_PORT = 19229;
export interface AccountsUiHandle {
    readonly port: number;
    readonly url: string;
    close: () => void;
    /** Forget in-memory focus (call with clearLiveFocus on Host dispose). */
    clearFocus: () => void;
}
export interface LiveTimelineFrame {
    id: number;
    file: string;
    step?: number;
    keyword?: string;
    at?: string;
}
/**
 * Start loopback accounts UI. Returns null if disabled / failed.
 */
export declare function startAccountsUiServer(options: {
    enabled: boolean;
    preferredPort: number;
    getEnv: () => Promise<LiteEnv>;
    home: string;
    binaryPath: string;
    log: {
        info: (msg: string, ...args: unknown[]) => void;
        warn: (msg: string, ...args: unknown[]) => void;
    };
}): Promise<AccountsUiHandle | null>;
/** Probe loopback health (Client). */
export declare function probeAccountsUi(ports?: number[]): Promise<string | null>;
