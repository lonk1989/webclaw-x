/**
 * Load and register the bundled webclaw-lite SKILL.md.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Resolve packaged assets/SKILL.md next to the compiled plugin. */
export declare function bundledSkillPath(): string;
/**
 * Parse name/description/body from YAML frontmatter SKILL.md.
 */
export declare function parseSkillMarkdown(raw: string): {
    readonly name: string;
    readonly description: string;
    readonly content: string;
} | undefined;
/**
 * Register the prefab skill into the host catalog.
 * Call only when `skills` is injected, or use `ctx.get('skills')` (never bare `ctx.skills` / Reflect).
 */
export declare function registerBundledSkill(ctx: Context): boolean;
