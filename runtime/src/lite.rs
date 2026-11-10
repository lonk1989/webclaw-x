//! 本机轻客户端（webclaw-lite）CLI：Skill 约定的工具面。
//!
//! 契约命令：`install` / `status` / `run` / `human-reply` / `last-log` / `update`
//! 远程 host / pair-redeem 不在本机主路径（仍可由同内核 worker 二进制提供）。

use serde_json::json;
use std::path::{Path, PathBuf};

/// Optional static base for `update` / install downloads.
/// Set `WEBCLAW_LITE_BASE` (directory prefix) or `WEBCLAW_WORKER_URL` (full exe URL).
/// Empty base falls back to GitHub Releases `latest` for the current OS.
pub const DEFAULT_STATIC_BASE: &str = "";

const GITHUB_LATEST_DIR: &str =
    "https://github.com/lonk1989/webclaw-x/releases/latest/download";

/// GitHub Releases "latest" asset URL for this host OS/arch.
pub fn default_github_latest_url() -> String {
    #[cfg(target_os = "windows")]
    {
        return format!("{GITHUB_LATEST_DIR}/webclaw-lite-windows-x64.exe");
    }
    #[cfg(target_os = "macos")]
    {
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x64"
        };
        return format!("{GITHUB_LATEST_DIR}/webclaw-lite-macos-{arch}");
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        format!("{GITHUB_LATEST_DIR}/webclaw-lite-linux-x64")
    }
}

/// Backward-compatible alias (Windows x64 latest URL).
pub const DEFAULT_GITHUB_LATEST_EXE: &str =
    "https://github.com/lonk1989/webclaw-x/releases/latest/download/webclaw-lite-windows-x64.exe";

pub fn default_download_url() -> String {
    if let Ok(u) = std::env::var("WEBCLAW_WORKER_URL") {
        let t = u.trim();
        if !t.is_empty() {
            return t.to_string();
        }
    }
    let base = std::env::var("WEBCLAW_LITE_BASE")
        .unwrap_or_else(|_| DEFAULT_STATIC_BASE.to_string());
    let base = base.trim().trim_end_matches('/');
    if base.is_empty() {
        return default_github_latest_url();
    }
    // Prefix is a release/static directory (GitHub download dir or mirror).
    // Asset sits directly under the prefix — not under a nested `/release/` folder.
    #[cfg(target_os = "windows")]
    {
        return format!("{base}/webclaw-lite-windows-x64.exe");
    }
    #[cfg(target_os = "macos")]
    {
        let arch = if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            "x64"
        };
        return format!("{base}/webclaw-lite-macos-{arch}");
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        format!("{base}/webclaw-lite-linux-x64")
    }
}

pub fn print_usage() {
    eprintln!(
        "webclaw-lite — 本机轻客户端 RPA（Skill/CLI）

用法:
  webclaw-lite install
  webclaw-lite status [--run-id <id>]
  webclaw-lite prewarm
  webclaw-lite browser status|stop|restart
  webclaw-lite serve [--socket <path>]   # daemon：ping/status/prewarm/run/cancel/human-reply/collect/quit（Unix socket；Windows=127.0.0.1 TCP + endpoint 文件）
  webclaw-lite probe [--url URL] [--types 输入框,按钮,图标按钮,链接] [--search 关键词] [--limit 60]
  webclaw-lite recipe save --name <stem> (--stdin | --file <path>) [--title 标题]
  webclaw-lite recipe list
  webclaw-lite run --recipe <file.webclaw|txt|name> [--title 名称] [--params JSON]
  webclaw-lite run --stdin [--title 名称] [--params JSON]
  webclaw-lite human-reply (--text CODE | --ok | --cancel) [--run-dir <run>]
  webclaw-lite cancel
  webclaw-lite last-log [--lines N]
  webclaw-lite update
  webclaw-lite skills sync --from-dir <目录>
  webclaw-lite skills list
  webclaw-lite accounts list
  webclaw-lite accounts ensure --id ehr|old-mes [--name 名称] --url URL
  webclaw-lite accounts set --id ehr|old-mes [--name 名称] [--url URL] --user 账号 --password 密码

说明:
  由 AI 助手按 SKILL.md 调用本 CLI；禁止用 Playwright 等重写步骤。
  编排期：probe 观察当前页 → 用返回指令拼短菜谱 → run 片段 → 再 probe（勿杀浏览器）。
  冻结：recipe save 写入 <WEBCLAW_HOME>/recipes/<name>.webclaw（DSH 优先写工作区 recipes/）。
  复跑期：只 run 完整菜谱（可用路径或 recipes 下的短名）；不要逐步 probe。
  执行 stdout 为 JSONL（run_start / step_* / need_human / done）；probe/recipe 为单条 JSON。
  遇验证码：读 need_human 事件 → 向用户要码 → human-reply --text … → 继续等 JSONL。
  正在跑的任务卡住：另开进程执行 cancel（不要用 human-reply --cancel 代替）。
  产物在 <WEBCLAW_HOME>/runs/<runId>/downloads|documents。

环境变量:
  WEBCLAW_HOME          数据根（默认 %LOCALAPPDATA%\\\\webclaw 或 ~/.webclaw）
  WEBCLAW_CHROME        Chrome/Edge 可执行文件
  WEBCLAW_CDP_PORT      CDP 端口（默认 19222）
  WEBCLAW_HEADLESS      0=有头窗口；未设时看 $WEBCLAW_HOME/display.json，默认无头
  webclaw-lite display [--headless 0|1]   # 读写显示偏好（对话切换有头/无头）
  webclaw-lite browser status|stop|restart  # 查询/关闭/重启本机 CDP 浏览器（勿用 PowerShell 杀进程）
  WEBCLAW_CHROME_RECYCLE 设为 1 时强制杀再启浏览器（默认复用健康 CDP）
  WEBCLAW_LITE_SOCKET   serve endpoint（Unix=socket 路径；Windows=endpoint JSON 文件，默认 <WEBCLAW_HOME>/lite.sock）
  WEBCLAW_LITE_USE_SERVE Host 设为 1 时优先走常驻 serve（缺省仍 CLI；不可达则回退 CLI，不重复执行）
  serve run 可选 early_hitl=true：遇人审先返回 NEED_HUMAN（busy 保持），再用 human-reply/collect 收尾；默认仍阻塞到 done
  WEBCLAW_VISION_ASSERT 设为 1 时启用「断言画面含 …」OCR 断言
  WEBCLAW_VISION_OCR_TIMEOUT_MS 画面断言 OCR 超时毫秒（默认 20000；与验证码 OCR Windows 实测对齐）
  WEBCLAW_CAPTCHA_OCR   设为 0 时关闭验证码 RapidOCR 试填（默认开，失败回落 HITL）
  WEBCLAW_CAPTCHA_OCR_MIN_CONF 验证码 OCR 最低置信度（默认 0.60）
  WEBCLAW_CAPTCHA_OCR_TIMEOUT_MS 验证码 OCR 超时毫秒（默认 20000；Windows DirectML 实测单次约 3–16s（视负载））
  WEBCLAW_CAPTCHA_OCR_SUBMIT 设为 0 时 OCR 只填不交（默认试填并自动点登录；错了再 HITL）
  WEBCLAW_HUMAN_DIR     人机交换目录（默认 <run>/human）
  WEBCLAW_WORKER_URL    update 下载地址（完整 URL）
  WEBCLAW_LITE_BASE     静态站/Release 目录前缀（拼平台资产名；
                        未设置时默认 GitHub Releases latest）
"
    );
}

/// 本机数据根与浏览器探测（不强制容器参数）。
pub fn ensure_lite_env() {
    std::env::set_var("WEBCLAW_WORKER", "1");
    std::env::set_var("WEBCLAW_LITE", "1");
    // Multi-round authoring: probe ↔ short run share the same CDP browser.
    if std::env::var_os("WEBCLAW_RESUME_BROWSER").is_none() {
        std::env::set_var("WEBCLAW_RESUME_BROWSER", "1");
    }
    // 本机勿默认 --no-sandbox
    if std::env::var_os("WEBCLAW_CDP_PORT").is_none() {
        std::env::set_var("WEBCLAW_CDP_PORT", "19222");
    }
    if std::env::var_os("WEBCLAW_HOME").is_none() {
        let dir = default_home_dir();
        let _ = std::fs::create_dir_all(&dir);
        std::env::set_var("WEBCLAW_HOME", &dir);
    }
    if std::env::var_os("WEBCLAW_CHROME").is_none() {
        if let Some(p) = crate::chrome::find_chrome_exe() {
            std::env::set_var("WEBCLAW_CHROME", p);
        }
    }
    if std::env::var_os("WEBCLAW_WORKER_URL").is_none() {
        std::env::set_var("WEBCLAW_WORKER_URL", default_download_url());
    }
    // 确保常用子目录
    if let Ok(home) = std::env::var("WEBCLAW_HOME") {
        let home = PathBuf::from(home);
        for sub in ["bin", "runs", "recipes", "jobs"] {
            let _ = std::fs::create_dir_all(home.join(sub));
        }
    }
}

fn default_home_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        return crate::paths::app_root_dir();
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = dirs::home_dir() {
            return home.join(".webclaw");
        }
        PathBuf::from(".webclaw")
    }
}

fn product_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn resolve_human_dir(run_dir: Option<&Path>) -> Result<PathBuf, String> {
    if let Ok(raw) = std::env::var("WEBCLAW_HUMAN_DIR") {
        let p = PathBuf::from(raw.trim());
        if !p.as_os_str().is_empty() {
            return Ok(p);
        }
    }
    if let Some(rd) = run_dir {
        return Ok(rd.join("human"));
    }
    // 从全局收件箱 / last-need-human 推断
    let data = crate::paths::app_data_dir();
    for name in ["need_human.json", "last-need-human.json"] {
        let p = data.join(name);
        if p.is_file() {
            if let Ok(raw) = std::fs::read_to_string(&p) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if let Some(rf) = v.get("replyFile").or_else(|| v.get("reply_file")) {
                        if let Some(s) = rf.as_str() {
                            if let Some(parent) = Path::new(s).parent() {
                                return Ok(parent.to_path_buf());
                            }
                        }
                    }
                    if let Some(img) = v.get("imagePath").or_else(|| v.get("image_path")) {
                        if let Some(s) = img.as_str() {
                            if let Some(parent) = Path::new(s).parent() {
                                return Ok(parent.to_path_buf());
                            }
                        }
                    }
                }
            }
        }
    }
    // 最近一次含 human/waiting_human.json 的 run
    let runs = crate::paths::runs_dir();
    if let Ok(rd) = std::fs::read_dir(&runs) {
        let mut dirs: Vec<PathBuf> = rd
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        dirs.sort_by_key(|p| {
            std::fs::metadata(p)
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0)
        });
        for p in dirs.into_iter().rev() {
            let waiting = p.join("human").join("waiting_human.json");
            if waiting.is_file() {
                return Ok(p.join("human"));
            }
        }
    }
    Err("未找到人机目录：请传 --run-dir，或确认任务正在等待验证码".into())
}

fn install_cli() -> Result<(), String> {
    ensure_lite_env();
    let home = PathBuf::from(std::env::var("WEBCLAW_HOME").map_err(|_| "WEBCLAW_HOME 未设置")?);
    let chrome = std::env::var("WEBCLAW_CHROME").unwrap_or_default();
    let bin_hint = std::env::current_exe()
        .ok()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let marker = home.join("lite-installed.json");
    let payload = json!({
        "type": "installed",
        "product": "webclaw-lite",
        "version": product_version(),
        "home": home.display().to_string(),
        "chrome": if chrome.is_empty() { serde_json::Value::Null } else { json!(chrome) },
        "bin": bin_hint,
        "cdpPort": std::env::var("WEBCLAW_CDP_PORT").unwrap_or_else(|_| "19222".into()),
        "updateUrl": default_download_url(),
    });
    std::fs::write(
        &marker,
        serde_json::to_string_pretty(&payload).unwrap_or_default(),
    )
    .map_err(|e| format!("写安装标记失败: {e}"))?;
    println!("{payload}");
    if chrome.is_empty() {
        eprintln!("警告: 未探测到 Chrome/Edge，请安装浏览器或设置 WEBCLAW_CHROME");
    }
    Ok(())
}

fn cancel_flag_path() -> Result<PathBuf, String> {
    let home = std::env::var("WEBCLAW_HOME").map_err(|_| "WEBCLAW_HOME 未设置")?;
    Ok(PathBuf::from(home).join("control").join("cancel"))
}

fn request_cancel() -> Result<PathBuf, String> {
    ensure_lite_env();
    let flag = cancel_flag_path()?;
    if let Some(parent) = flag.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建 control 目录失败: {e}"))?;
    }
    std::fs::write(&flag, b"1").map_err(|e| format!("写取消标记失败: {e}"))?;
    Ok(flag)
}

fn human_reply_cli(args: &[String]) -> Result<(), String> {
    let mut run_dir = None;
    let mut text = None;
    let mut ok = false;
    let mut cancel = false;
    let mut i = 2;
    while i < args.len() {
        match args[i].as_str() {
            "--run-dir" => {
                i += 1;
                run_dir = Some(PathBuf::from(
                    args.get(i).ok_or("--run-dir 需要路径")?,
                ));
            }
            "--text" => {
                i += 1;
                text = Some(args.get(i).ok_or("--text 需要验证码")?.clone());
            }
            "--ok" => ok = true,
            "--cancel" => cancel = true,
            "-h" | "--help" => {
                print_usage();
                return Ok(());
            }
            other => return Err(format!("未知参数: {other}")),
        }
        i += 1;
    }

    if cancel {
        let flag = request_cancel()?;
        if let Ok(human) = resolve_human_dir(run_dir.as_deref()) {
            let _ = std::fs::create_dir_all(&human);
            let _ = std::fs::write(human.join("human_reply.json"), r#"{"cancel":true}"#);
        }
        println!(
            "{}",
            json!({
                "type": "cancel_requested",
                "path": flag.display().to_string(),
            })
        );
        return Ok(());
    }
    let human = resolve_human_dir(run_dir.as_deref())?;
    std::fs::create_dir_all(&human).map_err(|e| format!("创建人机目录失败: {e}"))?;
    if ok {
        std::fs::write(human.join("human_reply.json"), r#"{"ok":true}"#)
            .map_err(|e| e.to_string())?;
        println!(
            "{}",
            json!({
                "type": "human_reply_written",
                "kind": "ok",
                "dir": human.display().to_string(),
            })
        );
        return Ok(());
    }
    let text = text.ok_or("需要 --text CODE 或 --ok 或 --cancel")?;
    std::fs::write(human.join("human_reply.txt"), format!("{}\n", text.trim()))
        .map_err(|e| e.to_string())?;
    println!(
        "{}",
        json!({
            "type": "human_reply_written",
            "kind": "text",
            "dir": human.display().to_string(),
        })
    );
    Ok(())
}


fn lite_prewarm() -> Result<(), String> {
    ensure_lite_env();
    let headless = crate::display::resolve_headless(None);
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    let (port, reused, msg) = rt.block_on(crate::chrome::ensure_worker_chrome(
        headless,
        true,
        "prewarm",
    ))?;
    println!(
        "{}",
        json!({
            "type": "prewarm",
            "ok": true,
            "port": port,
            "reused": reused,
            "message": msg,
        })
    );
    Ok(())
}

fn lite_runtime() -> Result<tokio::runtime::Runtime, String> {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())
}

fn lite_browser_status() -> Result<(), String> {
    ensure_lite_env();
    let port = crate::chrome::worker_cdp_port();
    let pid = crate::chrome::find_listener_pid(port);
    let rt = lite_runtime()?;
    let ready = rt.block_on(crate::chrome::is_debug_port_ready_on(port));
    println!(
        "{}",
        json!({
            "type": "browser_status",
            "ok": true,
            "port": port,
            "cdpReady": ready,
            "pid": pid,
            "headless": crate::display::resolve_headless(None),
        })
    );
    Ok(())
}

fn lite_browser_stop() -> Result<(), String> {
    ensure_lite_env();
    let port = crate::chrome::worker_cdp_port();
    let pid_before = crate::chrome::find_listener_pid(port);
    crate::browser_network::drop_port_capture(port);
    crate::chrome::kill_listeners_on_port(port);
    std::thread::sleep(std::time::Duration::from_millis(300));
    let rt = lite_runtime()?;
    if rt.block_on(crate::chrome::is_debug_port_ready_on(port)) {
        crate::chrome::kill_listeners_on_port(port);
        std::thread::sleep(std::time::Duration::from_millis(400));
    }
    let ready = rt.block_on(crate::chrome::is_debug_port_ready_on(port));
    let stopped = !ready;
    let pid_after = crate::chrome::find_listener_pid(port);
    println!(
        "{}",
        json!({
            "type": "browser_stop",
            "ok": stopped,
            "port": port,
            "stopped": stopped,
            "cdpReady": ready,
            "pidBefore": pid_before,
            "pidAfter": pid_after,
        })
    );
    if !stopped {
        return Err(format!(
            "BROWSER_STOP_FAILED: 端口 {port} 仍在监听 (before={pid_before:?}, after={pid_after:?})"
        ));
    }
    Ok(())
}

fn lite_browser_restart_inner(task_id: &str) -> Result<(u16, bool, String), String> {
    ensure_lite_env();
    let headless = crate::display::resolve_headless(None);
    let rt = lite_runtime()?;
    let (port, msg) = rt.block_on(crate::chrome::restart_worker_chrome(headless, task_id))?;
    // Explicit restart consumed any pending mode-change marker.
    let _ = crate::display::take_mode_change_recycle();
    Ok((port, headless, msg))
}

fn lite_browser_restart() -> Result<(), String> {
    let (port, headless, msg) = lite_browser_restart_inner("browser-restart")?;
    println!(
        "{}",
        json!({
            "type": "browser_restart",
            "ok": true,
            "port": port,
            "message": msg,
            "headless": headless,
            "cdpReady": true,
        })
    );
    Ok(())
}

fn lite_browser_cli(args: &[String]) -> Result<(), String> {
    let sub = args.get(2).map(|s| s.as_str()).unwrap_or("");
    match sub {
        "status" => lite_browser_status(),
        "stop" => lite_browser_stop(),
        "restart" => lite_browser_restart(),
        "-h" | "--help" | "help" | "" => {
            println!("usage: webclaw-lite browser status|stop|restart");
            println!("  status   CDP 端口是否就绪 / 监听 pid");
            println!("  stop     关闭本机 webclaw Chrome 实例（释放 CDP 端口）");
            println!("  restart  强制停掉并重新拉起浏览器");
            Ok(())
        }
        other => Err(format!(
            "未知子命令: {other}（可用 status、stop、restart）"
        )),
    }
}

/// Shared serve-session state (Unix socket + Windows TCP).
struct ServeShared {
    run_busy: std::sync::Mutex<bool>,
    final_result: std::sync::Mutex<Option<serde_json::Value>>,
    hitl_notified: std::sync::atomic::AtomicBool,
}

impl ServeShared {
    fn new() -> Self {
        Self {
            run_busy: std::sync::Mutex::new(false),
            final_result: std::sync::Mutex::new(None),
            hitl_notified: std::sync::atomic::AtomicBool::new(false),
        }
    }
}

fn serve_req_truthy(req: &serde_json::Value, key: &str) -> bool {
    match req.get(key) {
        Some(serde_json::Value::Bool(b)) => *b,
        Some(serde_json::Value::Number(n)) => n.as_i64() == Some(1) || n.as_u64() == Some(1),
        Some(serde_json::Value::String(s)) => {
            let t = s.trim();
            t == "1" || t.eq_ignore_ascii_case("true") || t.eq_ignore_ascii_case("yes")
        }
        _ => false,
    }
}

fn serve_parse_run_body(
    req: &serde_json::Value,
) -> Result<(String, String, std::collections::HashMap<String, String>), String> {
    let recipe = req
        .get("recipe")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let recipe_path = req
        .get("recipe_path")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let title = req
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("serve-run")
        .to_string();
    let params = match req.get("params") {
        None | Some(serde_json::Value::Null) => std::collections::HashMap::new(),
        Some(serde_json::Value::String(s)) => match serde_json::from_str::<serde_json::Value>(s) {
            Ok(serde_json::Value::Object(map)) => map
                .into_iter()
                .map(|(k, v)| {
                    (
                        k,
                        match v {
                            serde_json::Value::String(s) => s,
                            other => other.to_string(),
                        },
                    )
                })
                .collect(),
            _ => std::collections::HashMap::new(),
        },
        Some(serde_json::Value::Object(map)) => map
            .iter()
            .map(|(k, v)| {
                (
                    k.clone(),
                    match v {
                        serde_json::Value::String(s) => s.clone(),
                        other => other.to_string(),
                    },
                )
            })
            .collect(),
        Some(_) => std::collections::HashMap::new(),
    };
    let body = if !recipe.trim().is_empty() {
        recipe
    } else if !recipe_path.trim().is_empty() {
        std::fs::read_to_string(recipe_path.trim()).map_err(|e| e.to_string())?
    } else {
        return Err("provide recipe or recipe_path".into());
    };
    Ok((body, title, params))
}

fn serve_find_waiting_human(not_before: std::time::SystemTime) -> Option<serde_json::Value> {
    let home = std::env::var("WEBCLAW_HOME").ok()?;
    let runs = PathBuf::from(home).join("runs");
    let rd = std::fs::read_dir(&runs).ok()?;
    let mut best: Option<(std::time::SystemTime, PathBuf, serde_json::Value)> = None;
    for ent in rd.flatten() {
        let run_dir = ent.path();
        if !run_dir.is_dir() {
            continue;
        }
        let waiting = run_dir.join("human").join("waiting_human.json");
        if !waiting.is_file() {
            continue;
        }
        let human = run_dir.join("human");
        if human.join("human_reply.txt").is_file() || human.join("human_reply.json").is_file() {
            continue;
        }
        let modified = waiting.metadata().ok()?.modified().ok()?;
        // Ignore stale HITL files from prior runs (would false-trigger early_hitl).
        if modified < not_before {
            continue;
        }
        let raw = std::fs::read_to_string(&waiting).ok()?;
        let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
        if best.as_ref().map(|(t, _, _)| modified > *t).unwrap_or(true) {
            best = Some((modified, run_dir, v));
        }
    }
    let (_, run_dir, v) = best?;
    let human = run_dir.join("human");
    let prompt_id = v
        .get("promptId")
        .or_else(|| v.get("prompt_id"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let kind = v
        .get("kind")
        .and_then(|x| x.as_str())
        .unwrap_or("human")
        .to_string();
    let hint = v
        .get("hint")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let image_path = v
        .get("imagePath")
        .or_else(|| v.get("image_path"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    Some(json!({
        "type": "need_human",
        "kind": kind,
        "prompt_id": prompt_id,
        "hint": hint,
        "image_path": image_path,
        "reply_file": human.join("human_reply.txt").display().to_string(),
        "run_dir": run_dir.display().to_string(),
    }))
}

fn serve_tag_op(mut v: serde_json::Value, op: &str) -> serde_json::Value {
    if let Some(obj) = v.as_object_mut() {
        obj.insert("op".into(), json!(op));
    }
    v
}

fn serve_op_run(req: &serde_json::Value, shared: &std::sync::Arc<ServeShared>) -> serde_json::Value {
    {
        let mut guard = match shared.run_busy.lock() {
            Ok(g) => g,
            Err(e) => return json!({"ok": false, "op": "run", "error": e.to_string()}),
        };
        if *guard {
            return json!({
                "ok": false,
                "op": "run",
                "error_code": "RUN_BUSY",
                "error": "serve already has an active run",
            });
        }
        *guard = true;
    }
    if let Ok(mut slot) = shared.final_result.lock() {
        *slot = None;
    }
    shared
        .hitl_notified
        .store(false, std::sync::atomic::Ordering::SeqCst);

    let parsed = match serve_parse_run_body(req) {
        Ok(v) => v,
        Err(e) => {
            if let Ok(mut g) = shared.run_busy.lock() {
                *g = false;
            }
            return json!({"ok": false, "op": "run", "error": e, "error_code": "INVALID_ARGS"});
        }
    };
    let (text, title, params) = parsed;
    if let Some(h) = req.get("headless").and_then(|v| v.as_bool()) {
        crate::display::apply_cli_headless_flag(h);
    }
    let early_hitl = serve_req_truthy(req, "early_hitl");

    if !early_hitl {
        let result = crate::worker::run_recipe_text_blocking(text, title, params);
        if let Ok(mut g) = shared.run_busy.lock() {
            *g = false;
        }
        return match result {
            Ok(v) => serve_tag_op(v, "run"),
            Err(e) => json!({"ok": false, "op": "run", "error": e}),
        };
    }

    let shared_bg = shared.clone();
    let hitl_not_before = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(1))
        .unwrap_or_else(std::time::SystemTime::now);
    std::thread::spawn(move || {
        let result = crate::worker::run_recipe_text_blocking(text, title, params);
        let val = match result {
            Ok(v) => serve_tag_op(v, "run"),
            Err(e) => json!({"ok": false, "op": "run", "error": e}),
        };
        if let Ok(mut slot) = shared_bg.final_result.lock() {
            *slot = Some(val);
        }
        if let Ok(mut g) = shared_bg.run_busy.lock() {
            *g = false;
        }
    });

    let timeout = std::env::var("WEBCLAW_RUN_TIMEOUT_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .filter(|v| *v >= 1000)
        .unwrap_or(600_000);
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout);
    loop {
        let finished = shared
            .run_busy
            .lock()
            .map(|g| !*g)
            .unwrap_or(false);
        if finished {
            if let Ok(mut slot) = shared.final_result.lock() {
                if let Some(v) = slot.take() {
                    return v;
                }
            }
            return json!({
                "ok": false,
                "op": "run",
                "error": "serve run finished without result",
                "error_code": "RUN_FAILED",
            });
        }
        if !shared
            .hitl_notified
            .load(std::sync::atomic::Ordering::SeqCst)
        {
            if let Some(nh) = serve_find_waiting_human(hitl_not_before) {
                shared
                    .hitl_notified
                    .store(true, std::sync::atomic::Ordering::SeqCst);
                return json!({
                    "ok": false,
                    "op": "run",
                    "pending": true,
                    "error_code": "NEED_HUMAN",
                    "need_human": nh,
                    "done": serde_json::Value::Null,
                    "events_tail": [nh],
                });
            }
        }
        if std::time::Instant::now() >= deadline {
            let _ = request_cancel();
            return json!({
                "ok": false,
                "op": "run",
                "pending": true,
                "error": "serve run timed out waiting for human or completion",
                "error_code": "TIMEOUT",
            });
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

fn serve_op_collect(shared: &std::sync::Arc<ServeShared>, timeout_ms: u64) -> serde_json::Value {
    let deadline =
        std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms.max(1000));
    loop {
        let busy = shared.run_busy.lock().map(|g| *g).unwrap_or(false);
        if !busy {
            if let Ok(mut slot) = shared.final_result.lock() {
                if let Some(v) = slot.take() {
                    return v;
                }
            }
            return json!({
                "ok": false,
                "op": "collect",
                "error": "no pending serve run result",
                "error_code": "NO_ACTIVE_RUN",
            });
        }
        if std::time::Instant::now() >= deadline {
            return json!({
                "ok": false,
                "op": "collect",
                "error": "collect timed out",
                "error_code": "TIMEOUT",
            });
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

fn serve_op_human_reply(
    req: &serde_json::Value,
    shared: &std::sync::Arc<ServeShared>,
) -> serde_json::Value {
    let run_dir = req
        .get("run_dir")
        .and_then(|v| v.as_str())
        .map(PathBuf::from);
    let mode = req
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let text = req.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let human = match resolve_human_dir(run_dir.as_deref()) {
        Ok(h) => h,
        Err(e) => {
            return json!({"ok": false, "op": "human-reply", "error": e, "error_code": "INVALID_ARGS"})
        }
    };
    if let Err(e) = std::fs::create_dir_all(&human) {
        return json!({"ok": false, "op": "human-reply", "error": e.to_string()});
    }
    let write_res = if mode == "cancel" || serve_req_truthy(req, "cancel") {
        let _ = request_cancel();
        std::fs::write(human.join("human_reply.json"), r#"{"cancel":true}"#)
    } else if mode == "ok" || serve_req_truthy(req, "ok") {
        std::fs::write(human.join("human_reply.json"), r#"{"ok":true}"#)
    } else if !text.trim().is_empty() || mode == "text" {
        if text.trim().is_empty() {
            return json!({
                "ok": false,
                "op": "human-reply",
                "error": "text required",
                "error_code": "INVALID_ARGS",
            });
        }
        std::fs::write(human.join("human_reply.txt"), format!("{}\n", text.trim()))
    } else {
        return json!({
            "ok": false,
            "op": "human-reply",
            "error": "mode must be text|ok|cancel",
            "error_code": "INVALID_ARGS",
        });
    };
    if let Err(e) = write_res {
        return json!({"ok": false, "op": "human-reply", "error": e.to_string()});
    }
    let timeout = req
        .get("timeout_ms")
        .and_then(|v| v.as_u64())
        .or_else(|| {
            std::env::var("WEBCLAW_RUN_TIMEOUT_MS")
                .ok()
                .and_then(|s| s.parse().ok())
        })
        .unwrap_or(600_000);
    let mut out = serve_op_collect(shared, timeout);
    if let Some(obj) = out.as_object_mut() {
        obj.insert(
            "human_reply".into(),
            json!({"ok": true, "dir": human.display().to_string()}),
        );
    }
    out
}

#[cfg(unix)]
fn lite_serve(socket_path: &std::path::Path) -> Result<(), String> {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::net::UnixListener;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    ensure_lite_env();
    if socket_path.exists() {
        let _ = std::fs::remove_file(socket_path);
    }
    if let Some(parent) = socket_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let listener = UnixListener::bind(socket_path).map_err(|e| e.to_string())?;
    eprintln!("webclaw-lite serve listening on {}", socket_path.display());
    println!(
        "{}",
        json!({
            "type":"serve_started",
            "socket": socket_path.display().to_string(),
            "ops": ["ping","status","prewarm","run","cancel","human-reply","collect","quit"],
            "phase": 2,
        })
    );

    let shared = Arc::new(ServeShared::new());
    let shutting_down = Arc::new(AtomicBool::new(false));

    for conn in listener.incoming() {
        if shutting_down.load(Ordering::SeqCst) {
            break;
        }
        let stream = match conn {
            Ok(s) => s,
            Err(e) => {
                eprintln!("serve accept: {e}");
                continue;
            }
        };
        let shared = shared.clone();
        let shutting_down = shutting_down.clone();
        let sock_path = socket_path.to_path_buf();
        std::thread::spawn(move || {
            if let Err(e) = handle_serve_conn(stream, shared, shutting_down) {
                eprintln!("serve conn: {e}");
            }
            let _ = sock_path;
        });
    }
    let _ = std::fs::remove_file(socket_path);
    Ok(())
}

#[cfg(unix)]
fn handle_serve_conn(
    mut stream: std::os::unix::net::UnixStream,
    shared: std::sync::Arc<ServeShared>,
    shutting_down: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader, Write};
    use std::sync::atomic::Ordering;
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return Ok(());
    }
    let line = line.trim();
    if line.is_empty() {
        return Ok(());
    }
    let req: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => {
            let _ = writeln!(
                stream,
                "{}",
                json!({"ok":false,"error": format!("bad json: {e}")})
            );
            return Ok(());
        }
    };
    let op = req.get("op").and_then(|v| v.as_str()).unwrap_or("");
    let resp = match op {
        "ping" => json!({"ok": true, "op": "ping", "product": "webclaw-lite", "version": product_version()}),
        "status" => serve_status_value(),
        "prewarm" => match lite_prewarm_value() {
            Ok(v) => json!({"ok": true, "op": "prewarm", "result": v}),
            Err(e) => json!({"ok": false, "op": "prewarm", "error": e}),
        },
        "cancel" => match request_cancel() {
            Ok(flag) => json!({
                "ok": true,
                "op": "cancel",
                "path": flag.display().to_string(),
            }),
            Err(e) => json!({"ok": false, "op": "cancel", "error": e}),
        },
        "run" => serve_op_run(&req, &shared),
        "collect" => {
            let timeout = req
                .get("timeout_ms")
                .and_then(|v| v.as_u64())
                .unwrap_or(600_000);
            serve_op_collect(&shared, timeout)
        }
        "human-reply" => serve_op_human_reply(&req, &shared),
        "quit" | "exit" => {
            shutting_down.store(true, Ordering::SeqCst);
            let _ = request_cancel();
            let _ = write_serve_resp(&mut stream, json!({"ok": true, "op": "quit"}));
            // Unblock accept loop / stop daemon process.
            std::process::exit(0);
        }
        other => json!({
            "ok": false,
            "error": format!(
                "unsupported op '{other}' (phase-2 serve: ping|status|prewarm|run|cancel|human-reply|collect|quit)"
            ),
        }),
    };
    write_serve_resp(&mut stream, resp)
}

#[cfg(unix)]
fn write_serve_resp(
    stream: &mut std::os::unix::net::UnixStream,
    resp: serde_json::Value,
) -> Result<(), String> {
    use std::io::Write;
    let _ = writeln!(stream, "{resp}");
    Ok(())
}

fn serve_status_value() -> serde_json::Value {
    let home = std::env::var("WEBCLAW_HOME").unwrap_or_default();
    let chrome = std::env::var("WEBCLAW_CHROME").unwrap_or_default();
    let chrome_bin_ok = !chrome.is_empty() && Path::new(&chrome).is_file();
    let bin = std::env::current_exe()
        .ok()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let port = crate::chrome::worker_cdp_port();
    let cdp_ready = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .ok()
        .map(|rt| rt.block_on(crate::chrome::is_debug_port_ready_on(port)))
        .unwrap_or(false);
    let chrome_inspect = crate::chrome::inspect_chrome_on_port(port, cdp_ready);
    json!({
        "ok": true,
        "op": "status",
        "status": {
            "type": "status",
            "product": "webclaw-lite",
            "version": product_version(),
            "home": home,
            "bin": bin,
            "chrome": if chrome.is_empty() { serde_json::Value::Null } else { json!(chrome) },
            "chromeOk": chrome_bin_ok,
            "cdpPort": port,
            "cdpReady": cdp_ready,
            "chromeInstances": chrome_inspect,
            "statusSource": "lite_serve",
        }
    })
}


#[cfg(windows)]
fn lite_serve(endpoint_path: &std::path::Path) -> Result<(), String> {
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    ensure_lite_env();
    if let Some(parent) = endpoint_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Bind ephemeral loopback port; publish endpoint JSON at the same path Unix uses for the socket.
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let addr = listener.local_addr().map_err(|e| e.to_string())?;
    let endpoint = json!({
        "transport": "tcp",
        "host": "127.0.0.1",
        "port": addr.port(),
        "product": "webclaw-lite",
    });
    std::fs::write(
        endpoint_path,
        format!("{endpoint}\n"),
    )
    .map_err(|e| e.to_string())?;
    eprintln!(
        "webclaw-lite serve listening on {} (endpoint file {})",
        addr,
        endpoint_path.display()
    );
    println!(
        "{}",
        json!({
            "type":"serve_started",
            "socket": endpoint_path.display().to_string(),
            "transport": "tcp",
            "addr": addr.to_string(),
            "ops": ["ping","status","prewarm","run","cancel","human-reply","collect","quit"],
            "phase": 2,
        })
    );

    let shared = Arc::new(ServeShared::new());
    let shutting_down = Arc::new(AtomicBool::new(false));

    for conn in listener.incoming() {
        if shutting_down.load(Ordering::SeqCst) {
            break;
        }
        let stream = match conn {
            Ok(s) => s,
            Err(e) => {
                eprintln!("serve accept: {e}");
                continue;
            }
        };
        let shared = shared.clone();
        let shutting_down = shutting_down.clone();
        let ep = endpoint_path.to_path_buf();
        std::thread::spawn(move || {
            if let Err(e) = handle_serve_conn_tcp(stream, shared, shutting_down) {
                eprintln!("serve conn: {e}");
            }
            let _ = ep;
        });
    }
    let _ = std::fs::remove_file(endpoint_path);
    Ok(())
}

#[cfg(windows)]
fn handle_serve_conn_tcp(
    mut stream: std::net::TcpStream,
    shared: std::sync::Arc<ServeShared>,
    shutting_down: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader, Write};
    use std::sync::atomic::Ordering;
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return Ok(());
    }
    let line = line.trim();
    if line.is_empty() {
        return Ok(());
    }
    let req: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => {
            let _ = writeln!(
                stream,
                "{}",
                json!({"ok":false,"error": format!("bad json: {e}")})
            );
            return Ok(());
        }
    };
    let op = req.get("op").and_then(|v| v.as_str()).unwrap_or("");
    let resp = match op {
        "ping" => json!({"ok": true, "op": "ping", "product": "webclaw-lite", "version": product_version()}),
        "status" => serve_status_value(),
        "prewarm" => match lite_prewarm_value() {
            Ok(v) => json!({"ok": true, "op": "prewarm", "result": v}),
            Err(e) => json!({"ok": false, "op": "prewarm", "error": e}),
        },
        "cancel" => match request_cancel() {
            Ok(flag) => json!({
                "ok": true,
                "op": "cancel",
                "path": flag.display().to_string(),
            }),
            Err(e) => json!({"ok": false, "op": "cancel", "error": e}),
        },
        "run" => serve_op_run(&req, &shared),
        "collect" => {
            let timeout = req
                .get("timeout_ms")
                .and_then(|v| v.as_u64())
                .unwrap_or(600_000);
            serve_op_collect(&shared, timeout)
        }
        "human-reply" => serve_op_human_reply(&req, &shared),
        "quit" | "exit" => {
            shutting_down.store(true, Ordering::SeqCst);
            let _ = request_cancel();
            let _ = writeln!(stream, "{}", json!({"ok": true, "op": "quit"}));
            if let Ok(p) = std::env::var("WEBCLAW_LITE_SOCKET") {
                let _ = std::fs::remove_file(p);
            }
            std::process::exit(0);
        }
        other => json!({
            "ok": false,
            "error": format!(
                "unsupported op '{other}' (phase-2 serve: ping|status|prewarm|run|cancel|human-reply|collect|quit)"
            ),
        }),
    };
    let _ = writeln!(stream, "{resp}");
    Ok(())
}

fn lite_prewarm_value() -> Result<serde_json::Value, String> {
    ensure_lite_env();
    let headless = crate::display::resolve_headless(None);
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    let (port, reused, msg) = rt.block_on(crate::chrome::ensure_worker_chrome(
        headless,
        true,
        "prewarm",
    ))?;
    Ok(json!({"port": port, "reused": reused, "message": msg}))
}

fn lite_status(run_id: Option<&str>) -> Result<(), String> {
    ensure_lite_env();
    let home = std::env::var("WEBCLAW_HOME").unwrap_or_default();
    let chrome = std::env::var("WEBCLAW_CHROME").unwrap_or_default();
    let chrome_bin_ok = !chrome.is_empty() && Path::new(&chrome).is_file();
    let bin = std::env::current_exe()
        .ok()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let port = crate::chrome::worker_cdp_port();
    // Blocking probe: status is sync CLI.
    let cdp_ready = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .ok()
        .map(|rt| rt.block_on(crate::chrome::is_debug_port_ready_on(port)))
        .unwrap_or(false);
    let chrome_inspect = crate::chrome::inspect_chrome_on_port(port, cdp_ready);
    // chromeOk keeps "binary present" meaning for Host readiness; orphanRisk is the danger signal.
    let chrome_ok = chrome_bin_ok;

    // 复用 worker status 核心字段
    crate::worker::status_run_for_lite(run_id.unwrap_or(""), |base| {
        let mut v = base;
        if let Some(obj) = v.as_object_mut() {
            obj.insert("product".into(), json!("webclaw-lite"));
            obj.insert("version".into(), json!(product_version()));
            obj.insert("home".into(), json!(home));
            obj.insert(
                "chrome".into(),
                if chrome.is_empty() {
                    serde_json::Value::Null
                } else {
                    json!(chrome)
                },
            );
            obj.insert("chromeOk".into(), json!(chrome_ok));
            obj.insert("cdpPort".into(), json!(port));
            obj.insert("cdpReady".into(), json!(cdp_ready));
            obj.insert(
                "chromeInstances".into(),
                serde_json::to_value(&chrome_inspect).unwrap_or(serde_json::Value::Null),
            );
            if let Some(w) = &chrome_inspect.warn {
                obj.insert("chromeWarn".into(), json!(w));
            }
            obj.insert("bin".into(), json!(bin));
            obj.insert("updateUrl".into(), json!(default_download_url()));
            obj.insert("skillProvider".into(), json!("local"));
            obj.insert("corpSignedIn".into(), json!(false));
            obj.insert("corpUser".into(), serde_json::Value::Null);
            obj.insert(
                "headless".into(),
                json!(crate::display::resolve_headless(None)),
            );
        }
        println!("{}", serde_json::to_string(&v).unwrap_or_default());
    })
}

/// 轻客户端入口。
pub fn run_cli() {
    ensure_lite_env();
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("");

    match cmd {
        "" | "-h" | "--help" | "help" => {
            print_usage();
            std::process::exit(0);
        }
        "install" => match install_cli() {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
        },
        "skills" => {
            let sub = args.get(2).map(|s| s.as_str()).unwrap_or("list");
            let code = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => rt.block_on(async {
                    match sub {
                        "sync" => {
                            let from = crate::corp_skills::parse_sync_from_dir(&args);
                            let result = if let Some(dir) = from {
                                crate::corp_skills::sync_skills_from_dir(&dir).await
                            } else {
                                crate::corp_skills::sync_skills().await
                            };
                            match result {
                                Ok(n) => {
                                    println!("{}", json!({"type":"skills_synced","count": n}));
                                    0
                                }
                                Err(e) => {
                                    eprintln!("{e}");
                                    2
                                }
                            }
                        }
                        "list" => match crate::corp_skills::list_cached_names() {
                            Ok(items) => {
                                println!("{}", json!({"type":"skills","items": items}));
                                0
                            }
                            Err(e) => {
                                eprintln!("{e}");
                                2
                            }
                        },
                        other => {
                            eprintln!("未知子命令: {other}（可用 sync、list）");
                            2
                        }
                    }
                }),
                Err(e) => {
                    eprintln!("{e}");
                    2
                }
            };
            std::process::exit(code);
        }
        "cancel" => match request_cancel() {
            Ok(flag) => {
                println!(
                    "{}",
                    json!({
                        "type": "cancel_requested",
                        "path": flag.display().to_string(),
                    })
                );
                std::process::exit(0);
            }
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
        },
        "human-reply" => match human_reply_cli(&args) {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
        },
        "prewarm" => match lite_prewarm() {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
        },
        "browser" => match lite_browser_cli(&args) {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
        },
        "display" => {
            ensure_lite_env();
            let mut headless_arg: Option<bool> = None;
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--headless" => {
                        i += 1;
                        let v = args.get(i).map(|s| s.as_str()).unwrap_or("1");
                        headless_arg = Some(v != "0" && !v.eq_ignore_ascii_case("false"));
                    }
                    "--headed" => headless_arg = Some(false),
                    "-h" | "--help" => {
                        println!("usage: webclaw-lite display [--headless 0|1] [--headed]");
                        std::process::exit(0);
                    }
                    other => {
                        eprintln!("未知参数: {other}");
                        std::process::exit(2);
                    }
                }
                i += 1;
            }
            let prefs = match headless_arg {
                Some(h) => match crate::display::set_headless_pref(h) {
                    Ok(p) => p,
                    Err(e) => {
                        eprintln!("{e}");
                        std::process::exit(2);
                    }
                },
                None => crate::display::load_prefs(),
            };
            let effective = crate::display::resolve_headless(None);
            // 接管/切模式必须立刻回收 Chrome：display CLI 进程退出后内存 recycle 标志会丢，
            // 仅写 display.json 再复用无头实例时，用户看不见窗口。
            // 静默重启（勿 println），避免污染本命令唯一的 JSON stdout。
            let mut recycled = false;
            let mut recycle_note = String::new();
            let mut recycle_port: Option<u16> = None;
            if headless_arg.is_some() {
                match lite_browser_restart_inner("display-mode") {
                    Ok((port, _hl, msg)) => {
                        recycled = true;
                        recycle_port = Some(port);
                        recycle_note = msg;
                    }
                    Err(e) => {
                        recycle_note = format!("browser restart after display change failed: {e}");
                        eprintln!("{recycle_note}");
                    }
                }
            }
            println!(
                "{}",
                json!({
                    "type": "display",
                    "headless": prefs.headless,
                    "effective": effective,
                    "recycled": recycled,
                    "recycleNote": recycle_note,
                    "port": recycle_port,
                    "path": crate::display::display_file().display().to_string(),
                })
            );
            std::process::exit(0);
        }
        "serve" => {
            #[cfg(unix)]
            {
                let mut sock = std::env::var("WEBCLAW_LITE_SOCKET")
                    .ok()
                    .map(std::path::PathBuf::from)
                    .unwrap_or_else(|| {
                        let home = std::env::var("WEBCLAW_HOME").unwrap_or_else(|_| {
                            std::env::var("HOME").map(|h| format!("{h}/.webclaw")).unwrap_or_else(|_| ".webclaw".into())
                        });
                        std::path::PathBuf::from(home).join("lite.sock")
                    });
                let mut i = 2;
                while i < args.len() {
                    match args[i].as_str() {
                        "--socket" => {
                            i += 1;
                            if let Some(p) = args.get(i) {
                                sock = std::path::PathBuf::from(p);
                            }
                        }
                        "-h" | "--help" => {
                            print_usage();
                            std::process::exit(0);
                        }
                        other => {
                            eprintln!("未知参数: {other}");
                            std::process::exit(2);
                        }
                    }
                    i += 1;
                }
                match lite_serve(&sock) {
                    Ok(()) => std::process::exit(0),
                    Err(e) => {
                        eprintln!("{e}");
                        std::process::exit(2);
                    }
                }
            }
            #[cfg(windows)]
            {
                let mut sock = std::env::var("WEBCLAW_LITE_SOCKET")
                    .ok()
                    .map(std::path::PathBuf::from)
                    .unwrap_or_else(|| {
                        let home = std::env::var("WEBCLAW_HOME").unwrap_or_else(|_| {
                            std::env::var("LOCALAPPDATA")
                                .map(|h| format!("{h}\\webclaw"))
                                .or_else(|_| std::env::var("USERPROFILE").map(|h| format!("{h}\\.webclaw")))
                                .unwrap_or_else(|_| ".webclaw".into())
                        });
                        std::path::PathBuf::from(home).join("lite.sock")
                    });
                let mut i = 2;
                while i < args.len() {
                    match args[i].as_str() {
                        "--socket" => {
                            i += 1;
                            if let Some(p) = args.get(i) {
                                sock = std::path::PathBuf::from(p);
                            }
                        }
                        "-h" | "--help" => {
                            print_usage();
                            std::process::exit(0);
                        }
                        other => {
                            eprintln!("未知参数: {other}");
                            std::process::exit(2);
                        }
                    }
                    i += 1;
                }
                match lite_serve(&sock) {
                    Ok(()) => std::process::exit(0),
                    Err(e) => {
                        eprintln!("{e}");
                        std::process::exit(2);
                    }
                }
            }
            #[cfg(not(any(unix, windows)))]
            {
                eprintln!("serve 在此平台未实现");
                std::process::exit(2);
            }
        }
        "status" => {
            let mut run_id = None;
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--run-id" => {
                        i += 1;
                        run_id = args.get(i).cloned();
                    }
                    "-h" | "--help" => {
                        print_usage();
                        std::process::exit(0);
                    }
                    other => {
                        eprintln!("未知参数: {other}");
                        std::process::exit(2);
                    }
                }
                i += 1;
            }
            match lite_status(run_id.as_deref()) {
                Ok(()) => std::process::exit(0),
                Err(e) => {
                    eprintln!("{e}");
                    std::process::exit(1);
                }
            }
        }
        "probe" => {
            let code = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => match rt.block_on(crate::lite_probe::probe_cli(&args)) {
                    Ok(()) => 0,
                    Err(e) => {
                        println!("{}", json!({"type": "error", "error_code": crate::run_sink::error_code(&e), "error": e}));
                        eprintln!("{e}");
                        2
                    }
                },
                Err(e) => {
                    eprintln!("{e}");
                    2
                }
            };
            std::process::exit(code);
        }
        "recipe" => match crate::lite_recipes::recipe_cli(&args) {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
        },
        // 其余交给 worker 内核（run / update / last-log / accounts …）
        _ => crate::worker::run_cli(),
    }
}
