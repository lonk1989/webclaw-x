//! 中环洁 agent 网关：按名称拉取公开脚本 / 模板（Bearer + clientid）。
//!
//! 凭据优先读 `$WEBCLAW_HOME/corp-session.json`（或机器根目录同名文件），
//! 可用环境变量覆盖：`WEBCLAW_ZHJ_TOKEN` / `WEBCLAW_ZHJ_CLIENT_ID` / `WEBCLAW_ZHJ_BASE`。
//!
//! 模板附件走 `resource/oss/download/{ossId}`（与数字人头像同一套资源服务，不是 webclaw 桶）。

use crate::paths;
use crate::scripts::ScriptDef;
use crate::templates::{self, TemplateDef};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct CorpSession {
    pub token: String,
    pub client_id: String,
    /// `…/dev-api`（OSS / 资源）
    pub resource_base: String,
    /// `…/dev-api/agent`
    pub agent_base: String,
}

#[derive(Debug, Clone)]
pub struct RemoteScriptRow {
    pub script_id: String,
    pub name: String,
    pub content: String,
    pub remark: String,
}

#[derive(Debug, Clone)]
pub struct RemoteTemplateRow {
    pub template_id: String,
    pub name: String,
    pub oss_id: String,
    pub script_name: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
struct CorpSessionFile {
    #[serde(default)]
    token: String,
    #[serde(default, alias = "clientId")]
    client_id: String,
    #[serde(default, alias = "agentBaseUrl")]
    agent_base_url: String,
}

fn trim_slash(s: &str) -> String {
    s.trim().trim_end_matches('/').to_string()
}

fn resource_base_of(agent_base: &str) -> Option<String> {
    let agent = trim_slash(agent_base);
    if agent.is_empty() {
        return None;
    }
    if let Some(root) = agent.strip_suffix("/agent") {
        let root = trim_slash(root);
        if !root.is_empty() {
            return Some(root);
        }
    }
    None
}

fn corp_session_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    let a = paths::app_data_dir().join("corp-session.json");
    let b = paths::app_root_dir().join("corp-session.json");
    out.push(a);
    if b != out[0] {
        out.push(b);
    }
    out
}

/// 加载会话；无文件 / 字段不全时返回 None（调用方回退本地脚本库）。
pub fn load_corp_session() -> Option<CorpSession> {
    let env_token = std::env::var("WEBCLAW_ZHJ_TOKEN")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let env_client = std::env::var("WEBCLAW_ZHJ_CLIENT_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let env_base = std::env::var("WEBCLAW_ZHJ_BASE")
        .ok()
        .map(|s| trim_slash(&s))
        .filter(|s| !s.is_empty());

    let mut file: Option<CorpSessionFile> = None;
    for path in corp_session_candidates() {
        if !path.is_file() {
            continue;
        }
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(parsed) = serde_json::from_str::<CorpSessionFile>(&raw) {
                file = Some(parsed);
                break;
            }
        }
    }

    let token = env_token
        .or_else(|| file.as_ref().map(|f| f.token.trim().to_string()))
        .filter(|s| !s.is_empty())?;
    let token = token
        .strip_prefix("Bearer ")
        .or_else(|| token.strip_prefix("bearer "))
        .unwrap_or(&token)
        .trim()
        .to_string();
    if token.is_empty() {
        return None;
    }

    let client_id = env_client
        .or_else(|| file.as_ref().map(|f| f.client_id.trim().to_string()))
        .filter(|s| !s.is_empty())?;

    let agent_base = env_base
        .clone()
        .map(|b| {
            if b.ends_with("/agent") {
                b
            } else {
                format!("{b}/agent")
            }
        })
        .or_else(|| {
            file.as_ref()
                .map(|f| trim_slash(&f.agent_base_url))
                .filter(|s| !s.is_empty())
        })?;

    let resource_base = env_base
        .and_then(|b| {
            if b.ends_with("/agent") {
                resource_base_of(&b)
            } else {
                Some(b)
            }
        })
        .or_else(|| resource_base_of(&agent_base))?;

    Some(CorpSession {
        token,
        client_id,
        resource_base,
        agent_base,
    })
}

fn auth_headers(session: &CorpSession) -> reqwest::header::HeaderMap {
    use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION};
    let mut headers = HeaderMap::new();
    if let Ok(v) = HeaderValue::from_str(&format!("Bearer {}", session.token)) {
        headers.insert(AUTHORIZATION, v);
    }
    if let (Ok(name), Ok(v)) = (
        HeaderName::from_bytes(b"clientid"),
        HeaderValue::from_str(&session.client_id),
    ) {
        headers.insert(name, v);
    }
    if let Ok(v) = HeaderValue::from_str("zh_CN") {
        headers.insert(HeaderName::from_static("content-language"), v);
    }
    headers
}

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

fn get_json(session: &CorpSession, url: &str) -> Result<Value, String> {
    let client = http_client()?;
    let resp = client
        .get(url)
        .headers(auth_headers(session))
        .send()
        .map_err(|e| format!("请求失败: {e}"))?;
    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| format!("读取响应失败: {e}"))?;
    let value: Value = serde_json::from_str(&text).map_err(|_| {
        let preview: String = text.chars().take(160).collect();
        format!("响应异常 HTTP {}：{}", status.as_u16(), preview)
    })?;
    let code = value.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
    if code != 200 {
        let msg = value
            .get("msg")
            .and_then(|m| m.as_str())
            .unwrap_or("未知错误");
        return Err(format!("接口错误 code={code}: {msg}"));
    }
    Ok(value)
}

fn page_rows(value: &Value) -> Vec<&Value> {
    // 兼容 { data: { rows } } 与顶层 { rows }
    if let Some(rows) = value
        .pointer("/data/rows")
        .and_then(|v| v.as_array())
        .or_else(|| value.get("rows").and_then(|v| v.as_array()))
    {
        return rows.iter().collect();
    }
    Vec::new()
}

fn id_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.trim().to_string(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

/// 按名称模糊查询公开脚本；优先精确名匹配。
pub fn fetch_script_by_name(name: &str) -> Result<Option<RemoteScriptRow>, String> {
    let name = name.trim();
    if name.is_empty() {
        return Ok(None);
    }
    let Some(session) = load_corp_session() else {
        return Ok(None);
    };
    let encoded = urlencoding_encode(name);
    let t = chrono_millis();
    let url = format!(
        "{}/script/pageList?pageNum=1&pageSize=20&name={encoded}&isPublic=1&_t={t}",
        session.agent_base
    );
    let value = get_json(&session, &url)?;
    let mut best: Option<RemoteScriptRow> = None;
    for row in page_rows(&value) {
        let row_name = row
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if row_name.is_empty() {
            continue;
        }
        let content = row
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if content.trim().is_empty() {
            continue;
        }
        let parsed = RemoteScriptRow {
            script_id: id_string(row.get("scriptId").unwrap_or(&Value::Null)),
            name: row_name.to_string(),
            content,
            remark: row
                .get("remark")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        };
        if row_name == name {
            return Ok(Some(parsed));
        }
        if name.starts_with(row_name)
            || row_name.contains(name)
            || name.contains(row_name)
        {
            let take = match &best {
                None => true,
                Some(b) => row_name.chars().count() > b.name.chars().count(),
            };
            if take {
                best = Some(parsed);
            }
        }
    }
    Ok(best)
}

/// 按模板名查询；`name` 可部分匹配（如「考勤记录表」）。
pub fn fetch_template_by_name(name: &str) -> Result<Option<RemoteTemplateRow>, String> {
    let name = name.trim();
    if name.is_empty() {
        return Ok(None);
    }
    let Some(session) = load_corp_session() else {
        return Ok(None);
    };
    let encoded = urlencoding_encode(name);
    let t = chrono_millis();
    let url = format!(
        "{}/template/pageList?pageNum=1&pageSize=20&name={encoded}&isPublic=1&_t={t}",
        session.agent_base
    );
    let value = get_json(&session, &url)?;
    let mut best: Option<RemoteTemplateRow> = None;
    for row in page_rows(&value) {
        let row_name = row
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let oss_id = id_string(row.get("ossId").unwrap_or(&Value::Null));
        if row_name.is_empty() || oss_id.is_empty() {
            continue;
        }
        let parsed = RemoteTemplateRow {
            template_id: id_string(row.get("templateId").unwrap_or(&Value::Null)),
            name: row_name.to_string(),
            oss_id,
            script_name: row
                .get("scriptName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string(),
            description: row
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        };
        if row_name == name {
            return Ok(Some(parsed));
        }
        if row_name.contains(name) || name.contains(row_name) {
            let take = match &best {
                None => true,
                Some(b) => row_name.chars().count() > b.name.chars().count(),
            };
            if take {
                best = Some(parsed);
            }
        }
    }
    Ok(best)
}

/// 列出某脚本关联的公开模板（扫一页公开模板后按 scriptName 过滤）。
pub fn list_templates_for_script(script_name: &str) -> Result<Vec<RemoteTemplateRow>, String> {
    let script_name = script_name.trim();
    if script_name.is_empty() {
        return Ok(Vec::new());
    }
    let Some(session) = load_corp_session() else {
        return Ok(Vec::new());
    };
    let t = chrono_millis();
    let url = format!(
        "{}/template/pageList?pageNum=1&pageSize=50&isPublic=1&_t={t}",
        session.agent_base
    );
    let value = get_json(&session, &url)?;
    let mut out = Vec::new();
    for row in page_rows(&value) {
        let sn = row
            .get("scriptName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if sn != script_name {
            continue;
        }
        let row_name = row
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let oss_id = id_string(row.get("ossId").unwrap_or(&Value::Null));
        if row_name.is_empty() || oss_id.is_empty() {
            continue;
        }
        out.push(RemoteTemplateRow {
            template_id: id_string(row.get("templateId").unwrap_or(&Value::Null)),
            name: row_name.to_string(),
            oss_id,
            script_name: sn.to_string(),
            description: row
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        });
    }
    Ok(out)
}

fn oss_file_name(session: &CorpSession, oss_id: &str) -> Option<String> {
    let url = format!(
        "{}/resource/oss/listByIds/{}",
        session.resource_base,
        urlencoding_encode(oss_id)
    );
    let value = get_json(session, &url).ok()?;
    let data = value.get("data")?;
    let row = if let Some(arr) = data.as_array() {
        arr.first()?
    } else {
        data
    };
    let original = row
        .get("originalName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if !original.is_empty() {
        return Some(original.to_string());
    }
    let file_name = row
        .get("fileName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if file_name.is_empty() {
        None
    } else {
        Some(file_name.to_string())
    }
}

fn download_oss_bytes(session: &CorpSession, oss_id: &str) -> Result<Vec<u8>, String> {
    let url = format!(
        "{}/resource/oss/download/{}",
        session.resource_base,
        urlencoding_encode(oss_id)
    );
    let client = http_client()?;
    let resp = client
        .get(&url)
        .headers(auth_headers(session))
        .send()
        .map_err(|e| format!("下载 OSS 失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "下载 OSS 失败 HTTP {}（ossId={oss_id}）",
            resp.status().as_u16()
        ));
    }
    let ctype = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ctype.contains("json") || ctype.contains("text/html") {
        return Err(format!("OSS 下载返回非文件内容-type={ctype}（ossId={oss_id}）"));
    }
    let bytes = resp
        .bytes()
        .map_err(|e| format!("读取 OSS 内容失败: {e}"))?
        .to_vec();
    if bytes.is_empty() {
        return Err(format!("OSS 文件为空（ossId={oss_id}）"));
    }
    Ok(bytes)
}

fn sanitize_filename(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    let t = s.trim().trim_start_matches('.');
    if t.is_empty() {
        "template.bin".into()
    } else {
        t.to_string()
    }
}

/// 下载模板到本机 templates/ 并登记（非内置）。
pub fn ensure_remote_template(row: &RemoteTemplateRow) -> Result<PathBuf, String> {
    let Some(session) = load_corp_session() else {
        return Err("未登录企业会话（缺少 corp-session.json / WEBCLAW_ZHJ_*）".into());
    };
    templates::ensure_template_files()?;
    let preferred = oss_file_name(&session, &row.oss_id)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| row.name.clone());
    let filename = sanitize_filename(&preferred);
    let dest = templates::templates_dir().join(&filename);
    if !dest.is_file() {
        let bytes = download_oss_bytes(&session, &row.oss_id)?;
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&dest, &bytes).map_err(|e| format!("写入模板失败: {e}"))?;
    }
    let id = if row.template_id.is_empty() {
        format!("remote_{}", row.oss_id)
    } else {
        format!("remote_{}", row.template_id)
    };
    let _ = templates::save_template(TemplateDef {
        id,
        name: row.name.clone(),
        filename: filename.clone(),
        description: row.description.clone(),
        builtin: false,
        updated_at: Utc::now(),
    });
    Ok(dest)
}

/// 确保脚本关联模板已落盘；无关联时尝试按常见名「考勤记录表」拉一份。
pub fn ensure_templates_for_script(script_name: &str) -> Result<Vec<PathBuf>, String> {
    let mut rows = list_templates_for_script(script_name)?;
    if rows.is_empty() {
        if let Ok(Some(row)) = fetch_template_by_name("考勤记录表") {
            rows.push(row);
        }
    }
    let mut paths = Vec::new();
    for row in &rows {
        match ensure_remote_template(row) {
            Ok(p) => paths.push(p),
            Err(e) => eprintln!("[zhj_remote] 模板「{}」下载失败: {e}", row.name),
        }
    }
    Ok(paths)
}

/// 将远程脚本写入本地库（非内置），供后续离线解析。
/// 若与内置同名冲突，返回内存副本（本轮仍用云端正文）。
pub fn cache_remote_script(row: &RemoteScriptRow) -> Result<ScriptDef, String> {
    let id = if row.script_id.is_empty() {
        format!("remote_{}", row.name)
    } else {
        format!("remote_{}", row.script_id)
    };
    let def = ScriptDef {
        id: id.clone(),
        name: row.name.clone(),
        description: if row.remark.is_empty() {
            format!("云端脚本（{}）", row.name)
        } else {
            row.remark.clone()
        },
        builtin: false,
        script: row.content.clone(),
        updated_at: Utc::now(),
    };
    match crate::scripts::save_script(def.clone()) {
        Ok(saved) => Ok(saved),
        Err(e) if e.contains("已存在") => {
            if let Ok(Some(mut existing)) = crate::scripts::get_by_name(&row.name) {
                if !existing.builtin {
                    existing.script = row.content.clone();
                    existing.description = def.description.clone();
                    existing.updated_at = Utc::now();
                    return crate::scripts::save_script(existing);
                }
            }
            Ok(def)
        }
        Err(e) => Err(e),
    }
}

/// 解析时：有企业会话则优先用云端正文；并尽量拉齐关联模板。
pub fn resolve_script_prefer_remote(
    local: Option<ScriptDef>,
    name_hint: &str,
) -> Result<Option<ScriptDef>, String> {
    let hint = name_hint.trim();
    if hint.is_empty() && local.is_none() {
        return Ok(None);
    }
    if load_corp_session().is_none() {
        return Ok(local);
    }
    let query = if hint.is_empty() {
        local.as_ref().map(|s| s.name.as_str()).unwrap_or("")
    } else {
        hint
    };
    match fetch_script_by_name(query) {
        Ok(Some(row)) => {
            let _ = ensure_templates_for_script(&row.name);
            match cache_remote_script(&row) {
                Ok(def) => Ok(Some(def)),
                Err(e) => {
                    eprintln!("[zhj_remote] 缓存云端脚本失败: {e}");
                    Ok(Some(ScriptDef {
                        id: format!("remote_{}", row.script_id),
                        name: row.name,
                        description: row.remark,
                        builtin: false,
                        script: row.content,
                        updated_at: Utc::now(),
                    }))
                }
            }
        }
        Ok(None) => Ok(local),
        Err(e) => {
            eprintln!("[zhj_remote] 拉取脚本「{query}」失败: {e}");
            Ok(local)
        }
    }
}

fn chrono_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 最小 URL 编码（中文名 / ossId）。
fn urlencoding_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[allow(dead_code)]
pub fn template_exists_locally(name: &str) -> bool {
    let dir = templates::templates_dir();
    if !dir.is_dir() {
        return false;
    }
    let needle = name.trim();
    if needle.is_empty() {
        return false;
    }
    std::fs::read_dir(dir)
        .ok()
        .map(|rd| {
            rd.flatten().any(|e| {
                e.file_name()
                    .to_string_lossy()
                    .contains(needle.trim_end_matches(".xlsx").trim_end_matches(".xls"))
            })
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_base_strips_agent_suffix() {
        assert_eq!(
            resource_base_of("https://x.example/dev-api/agent"),
            Some("https://x.example/dev-api".into())
        );
    }

    #[test]
    fn sanitize_keeps_xlsx() {
        assert_eq!(sanitize_filename("考勤记录表-XXX.xlsx"), "考勤记录表-XXX.xlsx");
    }
}
