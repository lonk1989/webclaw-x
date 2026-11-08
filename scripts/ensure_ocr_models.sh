#!/usr/bin/env bash
# Download RapidOCR ppocrv6-small ONNX assets into the path webclaw-lite expects.
# Default: $XDG_DATA_HOME/webclaw/ocr-models or ~/.local/share/webclaw/ocr-models
set -euo pipefail
ROOT="${WEBCLAW_OCR_MODELS_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/webclaw/ocr-models}"
mkdir -p "$ROOT"
BASE="https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve"
declare -a FILES=(
  "PP-OCRv6_det_small.onnx|$BASE/v3.9.0/onnx/PP-OCRv6/det/PP-OCRv6_det_small.onnx|090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f"
  "PP-OCRv6_rec_small.onnx|$BASE/v3.9.0/onnx/PP-OCRv6/rec/PP-OCRv6_rec_small.onnx|6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884"
  "ch_ppocr_mobile_v2.0_cls_mobile.onnx|$BASE/v3.9.0/onnx/PP-OCRv4/cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx|e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c"
  "ppocrv6_dict.txt|$BASE/master/paddle/PP-OCRv6/rec/PP-OCRv6_rec_small/ppocrv6_dict.txt|b5f2bfe2bdd9448429e3e82b51c789775d9b42f2403d082b00662eb77e401c5d"
)
need=0
for row in "${FILES[@]}"; do
  IFS='|' read -r name url sha <<<"$row"
  dest="$ROOT/$name"
  if [[ -f "$dest" ]]; then
    got=$(sha256sum "$dest" | awk '{print $1}')
    if [[ "$got" == "$sha" ]]; then
      echo "OK $name"
      continue
    fi
    echo "re-download $name (sha mismatch)"
  else
    echo "download $name"
  fi
  need=1
  curl -L --fail --retry 5 --retry-delay 2 -o "$dest" "$url"
  got=$(sha256sum "$dest" | awk '{print $1}')
  if [[ "$got" != "$sha" ]]; then
    echo "SHA mismatch for $name: got $got want $sha" >&2
    exit 1
  fi
done
echo "ocr models ready at $ROOT"
