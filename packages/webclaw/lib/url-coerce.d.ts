/**
 * Rescue http(s) URLs mangled by Chinese verbs glued onto the scheme, and
 * rewrite recipes so lite's「打开」step does not treat `浏览器访问 http://…`
 * as a hostname (→ `xn--%20http-…`).
 */
/** Pull the best absolute http(s) URL out of a noisy string. */
export declare function coerceHttpUrl(raw: string): string;
/**
 * Rewrite a recipe so each URL is a clean `打开 <url>` fragment before lite parses it.
 */
export declare function sanitizeWebclawRecipe(recipe: string): string;
