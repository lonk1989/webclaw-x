use super::store::Recipe;

/// Legacy id kept so merge/migrate paths stay stable; OSS no longer seeds corp recipes.
pub const BUILTIN_MONTHLY_ATTENDANCE_ID: &str = "builtin_monthly_attendance";

/// No built-in corp recipes (no EHR / MES / OA aliases or sample flows).
pub fn default_recipes() -> Vec<Recipe> {
    vec![]
}
