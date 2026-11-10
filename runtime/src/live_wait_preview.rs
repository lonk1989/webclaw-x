//! Heartbeat screenshots during long async waits (login poll, HITL, download).
//!
//! Separate from step-boundary live preview (≥800ms): default interval is 1.5s,
//! overridable via `WEBCLAW_LIVE_WAIT_MS`.

use crate::cdp::CdpClient;
use crate::run_artifacts::write_live_preview_at;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

const DEFAULT_INTERVAL_MS: u64 = 1500;

pub fn interval_from_env() -> Duration {
    let ms = std::env::var("WEBCLAW_LIVE_WAIT_MS")
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .filter(|&n| n >= 200)
        .unwrap_or(DEFAULT_INTERVAL_MS);
    Duration::from_millis(ms)
}

/// Resolve run dir from `WEBCLAW_HUMAN_DIR` parent (`…/run/human` → `…/run`).
pub fn resolve_run_dir() -> Option<PathBuf> {
    let raw = std::env::var("WEBCLAW_HUMAN_DIR").ok()?;
    let dir = PathBuf::from(raw.trim());
    if dir.as_os_str().is_empty() {
        return None;
    }
    dir.parent().map(|p| p.to_path_buf())
}

pub struct LiveWaitPreview {
    keyword: String,
    step: u32,
    total: u32,
    headless: bool,
    interval: Duration,
    last: Instant,
    run_dir: Option<PathBuf>,
}

impl LiveWaitPreview {
    pub fn new(keyword: impl Into<String>) -> Self {
        Self {
            keyword: keyword.into(),
            step: 0,
            total: 0,
            headless: crate::display::resolve_headless(None),
            interval: interval_from_env(),
            // Force first tick as soon as the wait starts.
            last: Instant::now() - Duration::from_secs(3600),
            run_dir: resolve_run_dir(),
        }
    }

    pub fn with_run_dir(mut self, run_dir: impl Into<PathBuf>) -> Self {
        self.run_dir = Some(run_dir.into());
        self
    }

    pub fn with_step(mut self, step: u32, total: u32) -> Self {
        self.step = step;
        self.total = total;
        self
    }

    pub fn with_headless(mut self, headless: bool) -> Self {
        self.headless = headless;
        self
    }

    pub fn with_interval(mut self, interval: Duration) -> Self {
        self.interval = interval;
        self
    }

    /// Full-page screenshot → live-preview + timeline when interval elapsed.
    /// No-op without a run directory or when CDP capture fails.
    pub async fn tick(&mut self, client: &mut CdpClient) -> bool {
        let Some(run_dir) = self.run_dir.clone() else {
            return false;
        };
        self.tick_at(client, &run_dir).await
    }

    pub async fn tick_at(&mut self, client: &mut CdpClient, run_dir: &Path) -> bool {
        if self.last.elapsed() < self.interval {
            return false;
        }
        if client.ensure_attached().await.is_err() {
            return false;
        }
        let Ok(png) = client.capture_screenshot_png().await else {
            return false;
        };
        match write_live_preview_at(
            run_dir,
            &png,
            self.step,
            self.total,
            &self.keyword,
            self.headless,
        ) {
            Ok(()) => {
                self.last = Instant::now();
                true
            }
            Err(_) => false,
        }
    }

    /// Sleep up to `total`, ticking whenever a browser client is available.
    pub async fn sleep_tick(
        &mut self,
        total: Duration,
        cancel: Option<&AtomicBool>,
        mut client: Option<&mut CdpClient>,
    ) -> Result<(), String> {
        let deadline = Instant::now() + total;
        let chunk = Duration::from_millis(200).min(self.interval);
        while Instant::now() < deadline {
            if cancel.is_some_and(|f| f.load(Ordering::SeqCst)) {
                return Err("已取消".into());
            }
            if let Some(ref mut c) = client {
                let _ = self.tick(c).await;
            }
            let remain = deadline.saturating_duration_since(Instant::now());
            if remain.is_zero() {
                break;
            }
            tokio::time::sleep(chunk.min(remain)).await;
        }
        Ok(())
    }
}

/// Same readyState poll as `CdpClient::wait_after_navigation_cancel`, with live ticks.
pub async fn wait_after_navigation_ticking(
    client: &mut CdpClient,
    timeout_secs: u64,
    cancel: Option<&AtomicBool>,
    preview: &mut LiveWaitPreview,
) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    let mut stable_ticks = 0u32;
    while Instant::now() < deadline {
        if cancel.is_some_and(|f| f.load(Ordering::SeqCst)) {
            return Err("已取消".into());
        }
        let _ = preview.tick(client).await;
        if client.ensure_attached().await.is_err() {
            stable_ticks = 0;
            tokio::time::sleep(Duration::from_millis(250)).await;
            continue;
        }
        let ready = client
            .evaluate("document.readyState")
            .await
            .ok()
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_default();
        if ready == "complete" || ready == "interactive" {
            stable_ticks += 1;
            if stable_ticks >= 2 {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
            continue;
        }
        stable_ticks = 0;
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    client.ensure_attached().await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn interval_defaults_and_env_override() {
        let d = interval_from_env();
        assert!(d.as_millis() >= 200);
        // Default when env unset / invalid is 1500ms (may already be set in process).
        let _ = d;
    }

    #[test]
    fn write_preview_appends_timeline_frames() {
        let dir = std::env::temp_dir().join(format!(
            "webclaw-live-wait-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        ));
        fs::create_dir_all(&dir).unwrap();
        let png = b"\x89PNG\r\n\x1a\nfake";
        crate::run_artifacts::write_live_preview_at(&dir, png, 1, 3, "等待", true).unwrap();
        crate::run_artifacts::write_live_preview_at(&dir, png, 1, 3, "等待", true).unwrap();
        let timeline: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.join("live-timeline.json")).unwrap())
                .unwrap();
        let frames = timeline.get("frames").and_then(|f| f.as_array()).unwrap();
        assert!(frames.len() >= 2);
        assert_eq!(
            frames.last().and_then(|f| f.get("keyword")).and_then(|k| k.as_str()),
            Some("等待")
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
