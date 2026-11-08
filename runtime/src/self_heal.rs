//! Bounded deterministic self-heal policy. No LLM calls; no recipe replay.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct HealConfig {
    pub enabled: bool,
    pub short_retries: u32,
    pub retry_interval_ms: u64,
    pub refresh: bool,
    pub structural_anchors: HashMap<String, String>,
    pub hitl: bool,
    pub hitl_timeout_secs: u32,
    pub ai_hook_budget: u32,
}
impl Default for HealConfig {
    fn default() -> Self {
        Self { enabled: false, short_retries: 1, retry_interval_ms: 100,
               refresh: false, structural_anchors: HashMap::new(), hitl: false,
               hitl_timeout_secs: 60, ai_hook_budget: 0 }
    }
}
impl HealConfig {
    fn validate(&self) -> Result<(), String> {
        if self.short_retries > 3 || self.retry_interval_ms > 2000
            || !(10..=300).contains(&self.hitl_timeout_secs) || self.ai_hook_budget > 1
            || self.structural_anchors.len() > 100 {
            return Err("HEAL_CONFIG_INVALID: retry/delay/HITL/AI budgets out of bounds".into());
        }
        for (step, anchor) in &self.structural_anchors {
            if !step.starts_with("等待 ") || !valid_structural_anchor(anchor) {
                return Err("HEAL_CONFIG_INVALID: only explicit structural wait anchors are allowed".into());
            }
        }
        Ok(())
    }
    pub fn load() -> Result<Self, String> {
        if std::env::var("WEBCLAW_HEAL_ENABLED").as_deref() == Ok("0") { return Ok(Self::default()); }
        let explicit = std::env::var_os("WEBCLAW_HEAL_FILE");
        let path = explicit.as_ref().map(PathBuf::from)
            .unwrap_or_else(|| crate::paths::app_data_dir().join("heal.json"));
        let mut config: Self = match std::fs::read_to_string(path) {
            Ok(raw) => serde_json::from_str(&raw).map_err(|_| "HEAL_CONFIG_INVALID: invalid heal.json")?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound && explicit.is_none() => Self::default(),
            Err(_) => return Err("HEAL_CONFIG_INVALID: cannot read heal file".into()),
        };
        if std::env::var("WEBCLAW_HEAL_ENABLED").as_deref() == Ok("1") { config.enabled = true; }
        config.validate()?;
        Ok(config)
    }
}

pub fn valid_structural_anchor(anchor: &str) -> bool {
    let re = regex::Regex::new(r"^(按钮|输入框|链接)#[1-9][0-9]{0,3}(?:\s+([0-9]+(?:\.[0-9]+)?))?$").unwrap();
    match re.captures(anchor) {
        Some(c) => c.get(2).map(|v| v.as_str().parse::<f64>().map(|s| (1.0..=5.0).contains(&s)).unwrap_or(false)).unwrap_or(true),
        None => false,
    }
}

pub fn terminal_error(err: &str) -> bool {
    ["POLICY_DENIED", "AMBIGUOUS_TARGET", "已取消", "已停止", "NEED_HUMAN", "HEAL_CONFIG_INVALID", "NEED_REPAIR"]
        .iter().any(|s| err.contains(s))
}

pub fn retryable(keyword: &str, err: &str) -> bool {
    if terminal_error(err) { return false; }
    matches!(keyword, "等待" | "采集")
        && ["未找到", "超时", "未命中", "失败", "CDP", "不存在", "采集"].iter().any(|s| err.contains(s))
}

pub fn trace(step_index: Option<u32>, stage: &str, attempt: u32, config: &HealConfig) {
    crate::run_sink::emit_log(format!("SELF_HEAL {}", serde_json::json!({
        "step_index": step_index, "stage": stage, "attempt": attempt,
        "ai_hook": {"budget": config.ai_hook_budget, "used": 0, "implemented": false}
    })));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_are_disabled_and_budgets_capped() {
        let mut c = HealConfig::default();
        assert!(!c.enabled && !c.refresh && !c.hitl);
        assert!(c.validate().is_ok());
        c.short_retries = 4; assert!(c.validate().is_err());
        c.short_retries = 1; c.ai_hook_budget = 2; assert!(c.validate().is_err());
    }
    #[test]
    fn no_action_or_terminal_error_retries() {
        assert!(retryable("等待", "等待超时：未找到"));
        assert!(retryable("采集", "CDP 失败"));
        for kw in ["点击", "输入", "登录", "上传", "选择下拉", "断言"] {
            assert!(!retryable(kw, "未找到"));
        }
        for e in ["POLICY_DENIED", "AMBIGUOUS_TARGET", "已取消", "NEED_REPAIR"] {
            assert!(!retryable("等待", e));
        }
    }
    #[test]
    fn only_explicit_bounded_structural_waits() {
        assert!(valid_structural_anchor("按钮#1 1"));
        assert!(valid_structural_anchor("输入框#2"));
        for a in ["按钮#1 0.2", "按钮#0", "按钮#1 999", "点击按钮#1", "按钮#1，点击删除", "选择器#x"] {
            assert!(!valid_structural_anchor(a));
        }
    }
}
