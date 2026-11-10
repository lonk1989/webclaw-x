/**
 * Notify DSH Client to open the webclaw-live sidebar tab for a run,
 * and mirror JSONL log lines for the in-chat toolview while run is pending.
 */
export interface LiveFocusPayload {
    readonly runDir: string;
    readonly updatedAt: string;
    readonly seq: number;
}
export interface LiveLogPayload {
    readonly runDir: string;
    readonly lines: readonly string[];
    readonly updatedAt: string;
    readonly seq: number;
}
/** Persist focus marker under WEBCLAW_HOME/control. */
export declare function writeLiveFocus(home: string, runDir: string): LiveFocusPayload;
/** Best-effort POST to loopback accounts/live UI so Client can openTab immediately. */
export declare function notifyLiveFocusHttp(runDir: string): Promise<void>;
/** Write focus file and ping loopback UI. */
export declare function publishLiveFocus(home: string, runDir: string): Promise<LiveFocusPayload>;
/** Drop leftover focus/log markers so a cold Client start does not reopen the rail. */
export declare function clearLiveFocus(home: string): void;
/** Reset live log buffer at the start of a new run. */
export declare function resetLiveLog(home: string, hint?: string): void;
/** Extract a user-facing line from one JSONL event (or return plain text). */
export declare function formatLiveLogLine(raw: string): string | undefined;
/** Append one user-facing log line and persist for Client polling. */
export declare function appendLiveLog(home: string, message: string, runDir?: string): LiveLogPayload;
/** Parse a stdout chunk into complete lines and append live log messages. */
export declare function ingestLiveLogChunk(home: string, chunk: string, state: {
    buf: string;
}, runDir?: string): void;
