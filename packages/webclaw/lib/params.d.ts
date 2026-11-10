/**
 * Recipe「参数」helpers for DSH (mirrors runtime extract/merge for static params).
 *
 * Desktop shows these in the top 参数栏 before run. DSH has no native form API,
 * so the Host tools extract defaults, gate run until confirmed, then rewrite
 * `参数名=值` into the temp recipe (file declarations otherwise beat CLI --params).
 */
export interface RecipeParamKv {
    readonly name: string;
    readonly value: string;
}
/**
 * Split recipe into step segments on Chinese/ASCII commas.
 * Escape sequences `\,` `\，` keep the comma literal (same idea as runtime).
 *
 * Newlines become `，` (not empty): otherwise
 * `参数原因=家中有事\n登录EHR系统` collapses to `参数原因=家中有事登录EHR系统`
 * and the login step is lost.
 */
export declare function splitRecipeSteps(content: string): string[];
/**
 * Extract static `参数名=值` declarations (top bar / form fields).
 * Skips「动态参数」; last duplicate name wins order of first occurrence with last value.
 */
export declare function extractRecipeParams(content: string): RecipeParamKv[];
/** Drop static「参数」steps; keep「动态参数」and everything else. */
export declare function stripRecipeParamSteps(content: string): {
    body: string;
    params: RecipeParamKv[];
};
/** Rewrite content: prefix merged `参数名=值` then body without old static params. */
export declare function mergeParamsIntoContent(content: string, entries: readonly RecipeParamKv[]): string;
/**
 * If a bad split once glued `登录…` into a 参数 value and then stripped it,
 * recover login (and following) steps from the raw recipe.
 */
export declare function recoverLostActionSteps(rawContent: string, mergedContent: string): string;
/**
 * Apply overrides onto declared params (declared order preserved; new keys appended).
 */
export declare function applyParamOverrides(content: string, overrides?: Record<string, string> | null): {
    content: string;
    params: RecipeParamKv[];
};
/**
 * Collect `{{名称}}` placeholders that need user confirmation
 * (excludes builtins like 页签地址).
 */
export declare function extractMustacheParams(content: string): string[];
/**
 * Params the Host must confirm before browser start:
 * declared `参数名=值`, remaining `{{名}}`, and explicit tool `params` keys.
 */
export declare function collectConfirmableParams(content: string, overrides?: Record<string, string> | null): RecipeParamKv[];
/** Parse tool `params` arg: JSON object string or already-plain record. */
export declare function parseParamsArg(raw: unknown): Record<string, string> | undefined;
