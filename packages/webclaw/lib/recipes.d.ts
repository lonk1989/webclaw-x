/**
 * Local `.webclaw` recipe library helpers for the DSH plugin.
 */
export interface RecipesConfig {
    /** Absolute override; wins over cwd-relative. */
    readonly recipesDir?: string;
    /** Relative under agent cwd (default `recipes`). */
    readonly recipesRel?: string;
    /** WEBCLAW_HOME override from plugin config. */
    readonly webclawHome?: string;
}
export declare function webclawHome(config: RecipesConfig): string;
/** Sanitize stem for `foo.webclaw`. */
export declare function safeRecipeName(raw: string): string;
/**
 * Resolve the authoritative recipes directory.
 * Priority: absolute recipesDir → cwd/recipesRel → WEBCLAW_HOME/recipes.
 */
export declare function resolveRecipesDir(config: RecipesConfig, cwd?: string | null): string;
/** Extract optional `# title` from the first non-empty line. */
export declare function titleFromBody(body: string): string | undefined;
export declare function freezeRecipe(options: {
    readonly config: RecipesConfig;
    readonly name: string;
    readonly recipe: string;
    readonly cwd?: string | null;
    readonly title?: string;
}): {
    path: string;
    name: string;
    bytes: number;
};
export declare function listRecipes(config: RecipesConfig, cwd?: string | null): {
    dir: string;
    items: Array<{
        name: string;
        path: string;
        bytes: number;
        mtimeMs: number;
        title?: string;
    }>;
};
export declare function importRecipe(options: {
    readonly config: RecipesConfig;
    readonly sourcePath: string;
    readonly name?: string;
    readonly cwd?: string | null;
}): {
    path: string;
    name: string;
    bytes: number;
};
/**
 * Resolve a recipe path for run: absolute/existing, else under recipes dir / cwd.
 */
export declare function resolveRecipePath(config: RecipesConfig, recipePath: string, cwd?: string | null): string;
/** Best-effort agent session cwd from ToolRunContext. */
export declare function agentCwd(exec: {
    agent?: unknown;
}): string | undefined;
/** Best-effort chat session id for library artifact marks. */
export declare function agentSessionId(exec: {
    agent?: unknown;
}): string | undefined;
