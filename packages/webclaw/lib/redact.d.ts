/**
 * Scrub secrets from tool output before it reaches the model / chat.
 */
/** Best-effort redaction for eventsTail / stderr echoed to DSH. */
export declare function redactSecrets(text: string): string;
