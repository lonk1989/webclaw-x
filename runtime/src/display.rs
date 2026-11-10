//! Browser display preference: headless vs headed window.
//!
//! Resolution order (first hit wins):
//! 1. Explicit override (CLI / tool arg for this process)
//! 2. `$WEBCLAW_HOME/display.json` → `headless`
//! 3. Env `WEBCLAW_HEADLESS` (`0`/`false`/`off` → headed; `1`/`true` → headless)
//! 4. Product default: headless `true` (no popup Chrome for DSH users)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicI8, AtomicBool, Ordering};

/// Process-scoped CLI/tool override: -1 unset, 0 headed, 1 headless.
static PROCESS_CLI_OVERRIDE: AtomicI8 = AtomicI8::new(-1);

/// When display mode changes, next Chrome ensure should recycle the old process.
static RECYCLE_ON_MODE_CHANGE: AtomicBool = AtomicBool::new(false);

/// Cross-process marker: `webclaw-lite display` exits before the next `run`, so a
/// process-local atomic alone cannot force recycle of an already-running Chrome.
fn recycle_marker_path() -> PathBuf {
    crate::paths::app_data_dir()
        .join("control")
        .join("pending-chrome-recycle")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayPrefs {
    /// When true, Chrome starts with `--headless=new`.
    #[serde(default = "default_headless")]
    pub headless: bool,
}

fn default_headless() -> bool {
    true
}

impl Default for DisplayPrefs {
    fn default() -> Self {
        Self { headless: true }
    }
}

pub fn display_file() -> PathBuf {
    crate::paths::app_data_dir().join("display.json")
}

pub fn load_prefs() -> DisplayPrefs {
    let path = display_file();
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => DisplayPrefs::default(),
    }
}

pub fn save_prefs(prefs: &DisplayPrefs) -> Result<(), String> {
    let path = display_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    std::fs::write(&path, body + "\n").map_err(|e| e.to_string())
}

fn parse_boolish(raw: &str) -> Option<bool> {
    let t = raw.trim();
    if t.is_empty() {
        return None;
    }
    if matches!(
        t.to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on" | "headless"
    ) {
        return Some(true);
    }
    if matches!(
        t.to_ascii_lowercase().as_str(),
        "0" | "false" | "no" | "off" | "headed" | "visible"
    ) {
        return Some(false);
    }
    None
}

/// Env-only parse: missing → None (fall through to file/default).
pub fn env_headless_override() -> Option<bool> {
    std::env::var("WEBCLAW_HEADLESS")
        .ok()
        .and_then(|v| parse_boolish(&v))
}

fn process_cli_override() -> Option<bool> {
    match PROCESS_CLI_OVERRIDE.load(Ordering::SeqCst) {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    }
}

/// Resolve whether Chrome should be headless for this run.
/// Order: CLI/tool override → display.json (if present) → WEBCLAW_HEADLESS env → default true.
pub fn resolve_headless(cli_override: Option<bool>) -> bool {
    if let Some(v) = cli_override {
        return v;
    }
    if let Some(v) = process_cli_override() {
        return v;
    }
    let path = display_file();
    if path.is_file() {
        return load_prefs().headless;
    }
    if let Some(v) = env_headless_override() {
        return v;
    }
    true
}

/// Apply CLI `--headless` / `--headed` into the process so nested paths see it.
pub fn apply_cli_headless_flag(headless: bool) {
    let prev = resolve_headless(None);
    PROCESS_CLI_OVERRIDE.store(if headless { 1 } else { 0 }, Ordering::SeqCst);
    std::env::set_var("WEBCLAW_HEADLESS", if headless { "1" } else { "0" });
    if prev != headless {
        request_recycle_for_mode_change();
    }
}

/// Persist preference and sync env for subsequent Chrome launches in this process.
pub fn set_headless_pref(headless: bool) -> Result<DisplayPrefs, String> {
    let prefs = DisplayPrefs { headless };
    save_prefs(&prefs)?;
    // Clear one-shot CLI override so display.json wins next resolve in this process.
    PROCESS_CLI_OVERRIDE.store(-1, Ordering::SeqCst);
    std::env::set_var("WEBCLAW_HEADLESS", if headless { "1" } else { "0" });
    // Always recycle: display.json may already say headed while Chrome is still the
    // old headless process (cross-process recycle was lost). User「接管」must force relaunch.
    request_recycle_for_mode_change();
    Ok(prefs)
}

pub fn request_recycle_for_mode_change() {
    RECYCLE_ON_MODE_CHANGE.store(true, Ordering::SeqCst);
    let path = recycle_marker_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&path, b"1\n");
}

/// Consume mode-change recycle request (true once, then cleared).
/// Checks process flag **and** disk marker (survives CLI process exit).
pub fn take_mode_change_recycle() -> bool {
    let mem = RECYCLE_ON_MODE_CHANGE.swap(false, Ordering::SeqCst);
    let path = recycle_marker_path();
    let disk = path.is_file();
    if disk {
        let _ = std::fs::remove_file(&path);
    }
    mem || disk
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_boolish_values() {
        assert_eq!(parse_boolish("1"), Some(true));
        assert_eq!(parse_boolish("0"), Some(false));
        assert_eq!(parse_boolish("headed"), Some(false));
        assert_eq!(parse_boolish("nope"), None);
    }

    #[test]
    fn default_prefs_are_headless() {
        assert!(DisplayPrefs::default().headless);
    }

    #[test]
    fn cli_override_beats_default() {
        PROCESS_CLI_OVERRIDE.store(-1, Ordering::SeqCst);
        apply_cli_headless_flag(false);
        assert!(!resolve_headless(None));
        apply_cli_headless_flag(true);
        assert!(resolve_headless(None));
        PROCESS_CLI_OVERRIDE.store(-1, Ordering::SeqCst);
    }
}
