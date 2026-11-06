#!/usr/bin/env bash
# Thin wrapper — real logic in eval_smoke.py
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "${ROOT}/.venv/bin/python" "${ROOT}/scripts/eval_smoke.py" "$@"
