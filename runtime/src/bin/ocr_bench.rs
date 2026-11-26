//! One-off OCR cold/hot bench for Windows diagnosis (not shipped as product CLI).
//! Pass `--captcha` to exercise specialized captcha ONNX (ddddocr) instead of RapidOCR.
use std::time::Instant;

fn main() {
    let mut args = std::env::args().skip(1).collect::<Vec<_>>();
    let captcha_mode = args.iter().any(|a| a == "--captcha");
    args.retain(|a| a != "--captcha");
    let png = args.first().cloned().unwrap_or_else(|| {
        r"E:\Workspace\webclaw-x\fixtures\site\captcha-K7M2.png".to_string()
    });
    let bytes = std::fs::read(&png).expect("read png");
    println!("png_bytes={} path={png} captcha_mode={captcha_mode}", bytes.len());
    if captcha_mode {
        let ready = webclaw_lib::rhai_runtime::captcha_ocr::captcha_ocr_ready();
        println!("captcha_ocr_ready={ready}");
        if !ready {
            match webclaw_lib::rhai_runtime::captcha_ocr::ensure_captcha_models() {
                Ok(()) => println!("ensure_captcha_models=ok"),
                Err(e) => println!("ensure_captcha_models=ERR {e}"),
            }
        }
        let t0 = Instant::now();
        let r1 = webclaw_lib::rhai_runtime::captcha_ocr::ocr_captcha_bytes_scored(&bytes);
        let cold_ms = t0.elapsed().as_secs_f64() * 1000.0;
        match &r1 {
            Ok(s) => println!(
                "captcha_cold_ms={cold_ms:.1} text={:?} score={:.3}",
                s.text, s.mean_score
            ),
            Err(e) => println!("captcha_cold_ms={cold_ms:.1} ERR={e}"),
        }
        let t1 = Instant::now();
        let r2 = webclaw_lib::rhai_runtime::captcha_ocr::ocr_captcha_bytes_scored(&bytes);
        let hot_ms = t1.elapsed().as_secs_f64() * 1000.0;
        match &r2 {
            Ok(s) => println!(
                "captcha_hot_ms={hot_ms:.1} text={:?} score={:.3}",
                s.text, s.mean_score
            ),
            Err(e) => println!("captcha_hot_ms={hot_ms:.1} ERR={e}"),
        }
        return;
    }

    println!(
        "models_ready={}",
        webclaw_lib::rhai_runtime::local_ocr::ocr_models_ready()
    );
    let t0 = Instant::now();
    let r1 = webclaw_lib::rhai_runtime::local_ocr::ocr_image_bytes_scored(&bytes);
    let cold_ms = t0.elapsed().as_secs_f64() * 1000.0;
    match &r1 {
        Ok(s) => println!(
            "cold_ms={cold_ms:.1} text={:?} score={:.3} lines={}",
            s.text, s.mean_score, s.line_count
        ),
        Err(e) => println!("cold_ms={cold_ms:.1} ERR={e}"),
    }
    let t1 = Instant::now();
    let r2 = webclaw_lib::rhai_runtime::local_ocr::ocr_image_bytes_scored(&bytes);
    let hot_ms = t1.elapsed().as_secs_f64() * 1000.0;
    match &r2 {
        Ok(s) => println!(
            "hot_ms={hot_ms:.1} text={:?} score={:.3} lines={}",
            s.text, s.mean_score, s.line_count
        ),
        Err(e) => println!("hot_ms={hot_ms:.1} ERR={e}"),
    }
    let t2 = Instant::now();
    let r3 = webclaw_lib::rhai_runtime::local_ocr::ocr_image_bytes_scored(&bytes);
    let hot2_ms = t2.elapsed().as_secs_f64() * 1000.0;
    match &r3 {
        Ok(s) => println!("hot2_ms={hot2_ms:.1} text={:?} score={:.3}", s.text, s.mean_score),
        Err(e) => println!("hot2_ms={hot2_ms:.1} ERR={e}"),
    }
}
