//! Explicit navigation allowlist, not a browser network sandbox.
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct Policy {
    enabled: bool,
    allow_localhost: bool,
    allowed_hosts: Vec<String>,
}
impl Default for Policy {
    fn default() -> Self {
        Self { enabled: true, allow_localhost: true, allowed_hosts: Vec::new() }
    }
}
impl Policy {
    fn check(&self, raw: &str) -> Result<(), String> {
        if !self.enabled { return Ok(()); }
        let url = url::Url::parse(raw)
            .map_err(|_| "POLICY_DENIED: invalid navigation URL".to_string())?;
        // Internal blank tab only; never allow javascript:/file:/data: by default.
        if raw == "about:blank" { return Ok(()); }
        if !matches!(url.scheme(), "http" | "https") {
            return Err("POLICY_DENIED: only http/https navigation is allowed".into());
        }
        if !url.username().is_empty() || url.password().is_some() {
            return Err("POLICY_DENIED: URL credentials are forbidden".into());
        }
        let host = url.host_str().unwrap_or("").trim_end_matches('.').to_ascii_lowercase();
        if self.allow_localhost && matches!(host.as_str(), "localhost" | "127.0.0.1" | "[::1]" | "::1") {
            return Ok(());
        }
        if self.allowed_hosts.iter().any(|h| h.trim().trim_end_matches('.').eq_ignore_ascii_case(&host)) {
            return Ok(());
        }
        Err(format!("POLICY_DENIED: host '{host}' is not in allowed_hosts"))
    }
}

/// Re-read on every navigation; explicit missing/malformed policy fails closed.
pub fn check_navigation(url: &str) -> Result<(), String> {
    if std::env::var("WEBCLAW_POLICY_ENABLED").as_deref() == Ok("0") { return Ok(()); }
    let explicit = std::env::var_os("WEBCLAW_POLICY_FILE");
    let path = explicit.as_ref().map(PathBuf::from)
        .unwrap_or_else(|| crate::paths::app_data_dir().join("policy.json"));
    let policy = match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str::<Policy>(&raw)
            .map_err(|_| "POLICY_DENIED: invalid policy.json".to_string())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound && explicit.is_none() => Policy::default(),
        Err(_) => return Err("POLICY_DENIED: cannot read policy file".into()),
    };
    policy.check(url)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hosts_are_exact_not_suffixes() {
        let p = Policy { allowed_hosts: vec!["EXAMPLE.COM".into()], ..Policy::default() };
        assert!(p.check("https://example.com/path").is_ok());
        assert!(p.check("https://example.com./path").is_ok());
        for url in ["https://example.com.evil.test", "https://sub.example.com", "https://example.com@evil.test", "file:///tmp/x", "javascript:alert(1)"] {
            assert!(p.check(url).unwrap_err().contains("POLICY_DENIED"));
        }
    }
    #[test]
    fn localhost_defaults_and_switch() {
        let p = Policy::default();
        for u in ["http://localhost:8000", "http://127.0.0.1:123", "http://[::1]:9000", "about:blank"] {
            assert!(p.check(u).is_ok(), "{u}");
        }
        assert!(p.check("https://not-allowed.invalid").is_err());
        assert!(Policy { enabled: false, ..p }.check("https://not-allowed.invalid").is_ok());
    }
    #[test]
    fn malformed_policy_is_not_silently_ignored() {
        assert!(serde_json::from_str::<Policy>(r#"{"allowed_hosts":"*"}"#).is_err());
        assert!(serde_json::from_str::<Policy>(r#"{"allowd_hosts":[]}"#).is_err());
    }
}
