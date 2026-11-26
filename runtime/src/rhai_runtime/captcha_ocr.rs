//! Captcha-specialized OCR (ddddocr-compatible ONNX), independent of RapidOCR.
//!
//! Pipeline: whole PNG → grayscale H=64 (keep aspect) → normalize → CRNN/CTC.
//!
//! Cache dir: `%LOCALAPPDATA%/webclaw/captcha-models/`
//! - `common.onnx` — ddddocr 1.5.6 beta OCR (no text-detection stage)
//! - `charsets.json` — CTC blank-first charset matching beta (`["", "笤", ...]`)
//!
//! Fetch order: `WEBCLAW_MODELS_CDN` relative `captcha-models/...`, else extract from
//! the ddddocr PyPI wheel (Tsinghua/Aliyun/official mirrors). Dev one-shot:
//! download `ddddocr-1.5.6-py3-none-any.whl` and place it in the cache dir.
//!
//! Kill-switch: `WEBCLAW_CAPTCHA_SPECIALIZED=0` (RapidOCR-only for captcha).

use image::imageops::FilterType;
use ort::session::Session;
use ort::value::Tensor;
use parking_lot::Mutex;
use serde_json::Value;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use super::local_ocr::OcrBytesResult;

const MODEL_FILE: &str = "common.onnx";
const CHARSET_FILE: &str = "charsets.json";
/// ddddocr 1.5.6 common.onnx (beta) is ~50MB; reject tiny stubs.
const MODEL_MIN_BYTES: u64 = 1_000_000;
const TARGET_H: u32 = 64;

/// Prefer China mirrors (official PyPI often times out domestically).
const PYPI_WHEEL_URLS: &[&str] = &[
    "https://pypi.tuna.tsinghua.edu.cn/packages/54/74/418c1c0be49463799f9eeb307a8aa4013ff5fca5e0387f0ef2762fcdb4e2/ddddocr-1.5.6-py3-none-any.whl",
    "https://mirrors.aliyun.com/pypi/packages/54/74/418c1c0be49463799f9eeb307a8aa4013ff5fca5e0387f0ef2762fcdb4e2/ddddocr-1.5.6-py3-none-any.whl",
    "https://files.pythonhosted.org/packages/54/74/418c1c0be49463799f9eeb307a8aa4013ff5fca5e0387f0ef2762fcdb4e2/ddddocr-1.5.6-py3-none-any.whl",
];
const CHARSET_FALLBACK_URL: &str =
    "https://raw.githubusercontent.com/mzdk100/ddddocr-rs/master/charset.json";

static SESSION: OnceLock<Mutex<Option<CaptchaEngine>>> = OnceLock::new();

struct CaptchaEngine {
    session: Session,
    charset: Vec<String>,
    input_name: String,
    output_name: String,
}

fn captcha_specialized_enabled() -> bool {
    match std::env::var("WEBCLAW_CAPTCHA_SPECIALIZED").ok().as_deref() {
        Some("0") | Some("false") | Some("False") | Some("no") | Some("off") => false,
        _ => true,
    }
}

fn input_name() -> String {
    std::env::var("WEBCLAW_CAPTCHA_OCR_INPUT")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "input1".into())
}

fn output_name() -> String {
    std::env::var("WEBCLAW_CAPTCHA_OCR_OUTPUT")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "387".into())
}

fn model_path() -> PathBuf {
    crate::paths::captcha_models_dir().join(MODEL_FILE)
}

fn charset_path() -> PathBuf {
    crate::paths::captcha_models_dir().join(CHARSET_FILE)
}

/// True when specialized captcha OCR is enabled and model+charset are on disk.
pub fn captcha_ocr_ready() -> bool {
    if !captcha_specialized_enabled() {
        return false;
    }
    let model = model_path();
    let charset = charset_path();
    if !model.is_file() || !charset.is_file() {
        return false;
    }
    std::fs::metadata(&model)
        .map(|m| m.len() >= MODEL_MIN_BYTES)
        .unwrap_or(false)
}

/// Download / recover captcha ONNX + charset into the machine cache.
pub fn ensure_captcha_models() -> Result<(), String> {
    let dir = crate::paths::captcha_models_dir();
    let _ = std::fs::create_dir_all(&dir);
    ensure_charset()?;
    ensure_onnx()?;
    Ok(())
}

fn ensure_charset() -> Result<(), String> {
    let path = charset_path();
    if path.is_file() {
        if let Ok(cs) = load_charset(&path) {
            // Reject old (non-beta) charset accidentally paired with common.onnx.
            if cs.get(1).map(|s| s.as_str()) == Some("笤") {
                return Ok(());
            }
        }
        let _ = std::fs::remove_file(&path);
    }
    // Prefer extracting beta charset from the ddddocr wheel (matches common.onnx).
    if let Ok(wheel) = ensure_pypi_wheel() {
        if extract_beta_charset_from_wheel(&wheel).is_ok() {
            if load_charset(&path).is_ok() {
                return Ok(());
            }
        }
    }
    // CDN next
    let cdn = crate::rhai_runtime::model_cdn::cdn_url(&format!("captcha-models/{CHARSET_FILE}"));
    if !cdn.is_empty() {
        if crate::rhai_runtime::model_cdn::download_to_file(&cdn, &path).is_ok() {
            if load_charset(&path).is_ok() {
                return Ok(());
            }
            let _ = std::fs::remove_file(&path);
        }
    }
    crate::rhai_runtime::model_cdn::download_to_file(CHARSET_FALLBACK_URL, &path)
        .map_err(|e| format!("下载验证码字符集失败: {e}"))?;
    load_charset(&path).map(|_| ())
}

fn ensure_onnx() -> Result<(), String> {
    let path = model_path();
    if path.is_file() {
        let len = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        if len >= MODEL_MIN_BYTES {
            return Ok(());
        }
        let _ = std::fs::remove_file(&path);
    }
    let cdn = crate::rhai_runtime::model_cdn::cdn_url(&format!("captcha-models/{MODEL_FILE}"));
    if !cdn.is_empty() {
        if crate::rhai_runtime::model_cdn::download_to_file(&cdn, &path).is_ok() {
            let len = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            if len >= MODEL_MIN_BYTES {
                return Ok(());
            }
            let _ = std::fs::remove_file(&path);
        }
    }
    extract_onnx_from_pypi_wheel(&path)
}

fn ensure_pypi_wheel() -> Result<PathBuf, String> {
    let dir = crate::paths::captcha_models_dir();
    let wheel = dir.join("ddddocr-1.5.6-py3-none-any.whl");
    if wheel.is_file() && std::fs::metadata(&wheel).map(|m| m.len()).unwrap_or(0) >= 50_000_000 {
        return Ok(wheel);
    }
    let _ = std::fs::remove_file(&wheel);
    let mut last_err = String::from("无可用镜像");
    for url in PYPI_WHEEL_URLS {
        match crate::rhai_runtime::model_cdn::download_to_file(url, &wheel) {
            Ok(()) => return Ok(wheel),
            Err(e) => {
                last_err = e;
                let _ = std::fs::remove_file(&wheel);
            }
        }
    }
    Err(format!("下载 ddddocr wheel 失败: {last_err}"))
}

fn extract_onnx_from_pypi_wheel(dest: &Path) -> Result<(), String> {
    let wheel = ensure_pypi_wheel()?;
    let file = std::fs::File::open(&wheel).map_err(|e| format!("打开 wheel 失败: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("解析 wheel 失败: {e}"))?;
    let names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();
    // Prefer beta `common.onnx` (plan); fall back to `common_old.onnx`.
    let entry_name = names
        .iter()
        .find(|n| {
            let n = n.replace('\\', "/");
            n.ends_with("ddddocr/common.onnx") || n == "ddddocr/common.onnx"
        })
        .cloned()
        .or_else(|| {
            names
                .iter()
                .find(|n| n.replace('\\', "/").ends_with("common_old.onnx"))
                .cloned()
        })
        .ok_or_else(|| "wheel 内未找到 common.onnx / common_old.onnx".to_string())?;
    let mut entry = archive
        .by_name(&entry_name)
        .map_err(|e| format!("读取 {entry_name} 失败: {e}"))?;
    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("解压 ONNX 失败: {e}"))?;
    if (buf.len() as u64) < MODEL_MIN_BYTES {
        return Err(format!("ONNX 过小: {} bytes", buf.len()));
    }
    let tmp = dest.with_extension("onnx.part");
    {
        let mut out = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        out.write_all(&buf).map_err(|e| e.to_string())?;
        out.flush().map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, dest).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("保存 ONNX 失败: {e}")
    })?;
    // Best-effort: pull matching beta charset from the same wheel.
    let _ = extract_beta_charset_from_wheel(&wheel);
    Ok(())
}

/// Parse beta `self.__charset = ["", "笤", ...]` from ddddocr `__init__.py` inside the wheel.
fn extract_beta_charset_from_wheel(wheel: &Path) -> Result<(), String> {
    let file = std::fs::File::open(wheel).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut entry = archive
        .by_name("ddddocr/__init__.py")
        .map_err(|e| format!("wheel 无 __init__.py: {e}"))?;
    let mut src = String::new();
    entry
        .read_to_string(&mut src)
        .map_err(|e| format!("读 __init__.py 失败: {e}"))?;
    let marker = "common.onnx";
    let Some(marker_pos) = src.find(marker) else {
        return Err("未找到 common.onnx 标记".into());
    };
    let rest = &src[marker_pos..];
    let Some(rel) = rest.find("[\"\",") else {
        return Err("未找到 beta charset 数组".into());
    };
    let start = marker_pos + rel;
    let bytes = src.as_bytes();
    let mut depth = 0i32;
    let mut in_str = false;
    let mut quote = b'"';
    let mut escape = false;
    let mut end = None;
    let mut i = start;
    while i < bytes.len() {
        let ch = bytes[i];
        if in_str {
            if escape {
                escape = false;
            } else if ch == b'\\' {
                escape = true;
            } else if ch == quote {
                in_str = false;
            }
        } else if ch == b'"' || ch == b'\'' {
            in_str = true;
            quote = ch;
        } else if ch == b'[' {
            depth += 1;
        } else if ch == b']' {
            depth -= 1;
            if depth == 0 {
                end = Some(i + 1);
                break;
            }
        }
        i += 1;
    }
    let end = end.ok_or_else(|| "charset 数组未闭合".to_string())?;
    let arr: Value = serde_json::from_str(&src[start..end])
        .map_err(|e| format!("解析 beta charset 失败: {e}"))?;
    if !arr.is_array() || arr.as_array().map(|a| a.len()).unwrap_or(0) < 100 {
        return Err("beta charset 过短".into());
    }
    // Sanity: beta charset starts with blank then 笤
    let first = arr
        .as_array()
        .and_then(|a| a.get(1))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if first != "笤" {
        return Err(format!("beta charset 首字异常: {first}"));
    }
    let path = charset_path();
    let tmp = path.with_extension("json.part");
    {
        let mut out = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        out.write_all(arr.to_string().as_bytes())
            .map_err(|e| e.to_string())?;
        out.flush().map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_charset(path: &Path) -> Result<Vec<String>, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("读字符集失败: {e}"))?;
    let v: Value =
        serde_json::from_str(&raw).map_err(|e| format!("解析字符集 JSON 失败: {e}"))?;
    let arr = if let Some(a) = v.as_array() {
        a
    } else if let Some(a) = v.get("charset").and_then(|x| x.as_array()) {
        a
    } else {
        return Err("字符集须为 JSON 数组或含 charset 字段".into());
    };
    let out: Vec<String> = arr
        .iter()
        .map(|x| {
            x.as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| x.to_string().trim_matches('"').to_string())
        })
        .collect();
    if out.len() < 10 {
        return Err(format!("字符集过短: {}", out.len()));
    }
    Ok(out)
}

fn load_engine() -> Result<(), String> {
    ensure_captcha_models()?;
    let charset = load_charset(&charset_path())?;
    let session = Session::builder()
        .map_err(|e| format!("ORT SessionBuilder: {e}"))?
        .commit_from_file(model_path())
        .map_err(|e| format!("加载验证码 ONNX 失败: {e}"))?;
    let engine = CaptchaEngine {
        session,
        charset,
        input_name: input_name(),
        output_name: output_name(),
    };
    *SESSION.get_or_init(|| Mutex::new(None)).lock() = Some(engine);
    Ok(())
}

fn with_engine<R>(f: impl FnOnce(&mut CaptchaEngine) -> Result<R, String>) -> Result<R, String> {
    let slot = SESSION.get_or_init(|| Mutex::new(None));
    let mut guard = slot.lock();
    if guard.is_none() {
        drop(guard);
        load_engine()?;
        guard = slot.lock();
    }
    f(guard.as_mut().ok_or_else(|| "验证码 OCR 引擎未就绪".to_string())?)
}

/// Preprocess PNG/JPEG bytes → NCHW float tensor `[1,1,64,W]` (ddddocr default).
pub fn preprocess_captcha_image(bytes: &[u8]) -> Result<(Vec<f32>, usize, usize), String> {
    let img = image::load_from_memory(bytes).map_err(|e| format!("验证码读图失败: {e}"))?;
    let (ow, oh) = (img.width().max(1), img.height().max(1));
    // Match ddddocr: int(w * (64 / h)) — truncate, not round.
    let new_w = (((ow as f64) * (TARGET_H as f64 / oh as f64)) as u32).max(1);
    let resized = img.resize_exact(new_w, TARGET_H, FilterType::Triangle);
    let gray = resized.to_luma8();
    let w = gray.width() as usize;
    let h = gray.height() as usize;
    let mut data = Vec::with_capacity(w * h);
    for p in gray.pixels() {
        // ddddocr builtin: (x/255 - 0.5) / 0.5
        data.push((p[0] as f32 / 255.0 - 0.5) / 0.5);
    }
    Ok((data, h, w))
}

fn ctc_greedy_decode(logits: &[f32], time: usize, classes: usize, charset: &[String]) -> (String, f32) {
    if time == 0 || classes == 0 || logits.len() < time * classes {
        return (String::new(), 0.0);
    }
    let mut text = String::new();
    let mut last: Option<usize> = None;
    let mut conf_sum = 0.0f32;
    let mut conf_n = 0u32;
    for t in 0..time {
        let row = &logits[t * classes..(t + 1) * classes];
        let (mut best_i, mut best_v) = (0usize, f32::NEG_INFINITY);
        for (i, &v) in row.iter().enumerate() {
            if v > best_v {
                best_v = v;
                best_i = i;
            }
        }
        // Softmax-ish confidence from max logit vs row (use max probability if already probs).
        let conf = if best_v >= 0.0 && best_v <= 1.0 && row.iter().all(|&x| (0.0..=1.0).contains(&x)) {
            best_v
        } else {
            // approx: sigmoid of margin
            let mut second = f32::NEG_INFINITY;
            for (i, &v) in row.iter().enumerate() {
                if i != best_i && v > second {
                    second = v;
                }
            }
            let margin = best_v - second;
            1.0 / (1.0 + (-margin).exp())
        };
        if last != Some(best_i) {
            if let Some(ch) = charset.get(best_i) {
                if !ch.is_empty() {
                    text.push_str(ch);
                    conf_sum += conf;
                    conf_n += 1;
                }
            }
            last = Some(best_i);
        }
    }
    let mean = if conf_n == 0 {
        0.0
    } else {
        conf_sum / conf_n as f32
    };
    (text, mean)
}

fn decode_index_sequence(indices: &[i64], charset: &[String]) -> (String, f32) {
    let mut text = String::new();
    let mut last = i64::MIN;
    let mut n = 0u32;
    for &item in indices {
        if item == last {
            continue;
        }
        last = item;
        if item < 0 {
            continue;
        }
        if let Some(ch) = charset.get(item as usize) {
            if !ch.is_empty() {
                text.push_str(ch);
                n += 1;
            }
        }
    }
    // Index-only outputs have no per-class probs; use length-based heuristic score.
    let mean = if n == 0 { 0.0 } else { 0.85 };
    (text, mean)
}

fn run_inference(engine: &mut CaptchaEngine, bytes: &[u8]) -> Result<OcrBytesResult, String> {
    let (data, h, w) = preprocess_captcha_image(bytes)?;
    let input = Tensor::from_array(([1usize, 1, h, w], data))
        .map_err(|e| format!("构造验证码输入失败: {e}"))?;

    let outputs = engine
        .session
        .run(ort::inputs![engine.input_name.clone() => input])
        .map_err(|e| format!("验证码推理失败: {e}"))?;

    // Prefer named output key; fall back to first output.
    let out_key = if outputs.contains_key(engine.output_name.as_str()) {
        engine.output_name.as_str()
    } else {
        outputs
            .keys()
            .next()
            .ok_or_else(|| "验证码模型无输出".to_string())?
    };

    // Float logits / probs (classic ddddocr)
    if let Ok((shape, data)) = outputs[out_key].try_extract_tensor::<f32>() {
        let dims: Vec<usize> = shape.iter().map(|d| *d as usize).collect();
        let (time, classes) = match dims.as_slice() {
            // [T, 1, C] or [1, T, C] or [T, C]
            [t, 1, c] => (*t, *c),
            [1, t, c] => (*t, *c),
            [t, c] => (*t, *c),
            [t, 1, c, ..] => (*t, *c),
            other => {
                let classes = engine.charset.len();
                let total = other.iter().product::<usize>();
                if classes == 0 || total % classes != 0 {
                    return Err(format!("无法解析输出形状: {other:?}"));
                }
                (total / classes, classes)
            }
        };
        let (text, mean_score) = ctc_greedy_decode(data, time, classes, &engine.charset);
        return Ok(OcrBytesResult {
            text,
            mean_score,
            line_count: 1,
        });
    }

    // Integer index sequence (ddddocr-rs style)
    if let Ok((_shape, data)) = outputs[out_key].try_extract_tensor::<i64>() {
        let (text, mean_score) = decode_index_sequence(data, &engine.charset);
        return Ok(OcrBytesResult {
            text,
            mean_score,
            line_count: 1,
        });
    }

    Err("验证码模型输出类型既非 f32 也非 i64".into())
}

/// OCR captcha image bytes with specialized model. Does not require RapidOCR.
pub fn ocr_captcha_bytes_scored(bytes: &[u8]) -> Result<OcrBytesResult, String> {
    if !captcha_specialized_enabled() {
        return Err("验证码专用 OCR 已禁用 (WEBCLAW_CAPTCHA_SPECIALIZED=0)".into());
    }
    with_engine(|engine| run_inference(engine, bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preprocess_produces_nchw_64h() {
        // 1x1 PNG
        let png = {
            let mut img = image::RgbaImage::new(80, 40);
            for p in img.pixels_mut() {
                *p = image::Rgba([10, 20, 30, 255]);
            }
            let mut buf = Vec::new();
            image::DynamicImage::ImageRgba8(img)
                .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
                .unwrap();
            buf
        };
        let (data, h, w) = preprocess_captcha_image(&png).unwrap();
        assert_eq!(h, 64);
        assert!(w >= 1);
        assert_eq!(data.len(), h * w);
        assert!(data.iter().all(|v| (-1.01..=1.01).contains(v)));
    }

    #[test]
    fn ctc_decode_skips_blank_and_dupes() {
        let charset = vec!["".into(), "6".into(), "*".into(), "3".into(), "=".into()];
        // T=5, C=5 — sequence 1,1,2,3,4 → "6*3="
        let mut logits = vec![0.0f32; 5 * 5];
        let picks = [1usize, 1, 2, 3, 4];
        for (t, &cls) in picks.iter().enumerate() {
            logits[t * 5 + cls] = 5.0;
        }
        let (text, score) = ctc_greedy_decode(&logits, 5, 5, &charset);
        assert_eq!(text, "6*3=");
        assert!(score > 0.5);
    }

    #[test]
    fn captcha_ocr_ready_false_when_specialized_disabled() {
        std::env::set_var("WEBCLAW_CAPTCHA_SPECIALIZED", "0");
        assert!(!captcha_ocr_ready());
        std::env::remove_var("WEBCLAW_CAPTCHA_SPECIALIZED");
    }

    #[test]
    fn captcha_models_dir_is_under_webclaw() {
        let dir = crate::paths::captcha_models_dir();
        let s = dir.to_string_lossy().to_lowercase();
        assert!(
            s.contains("captcha-models"),
            "unexpected captcha models dir: {dir:?}"
        );
    }

    #[test]
    fn specialized_reads_alnum_fixture_when_models_present() {
        if !captcha_ocr_ready() {
            // CI / fresh machines without captcha-models cache.
            return;
        }
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("fixtures")
            .join("site")
            .join("captcha-K7M2.png");
        let bytes = std::fs::read(&path).expect("fixture captcha-K7M2.png");
        let scored = ocr_captcha_bytes_scored(&bytes).expect("captcha ocr");
        let flat: String = scored
            .text
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_uppercase();
        assert!(
            flat.contains("K7M2"),
            "expected K7M2, got {:?} score={}",
            scored.text,
            scored.mean_score
        );
        assert!(scored.mean_score > 0.4);
    }
}
