#!/usr/bin/env python3
"""CLI: paste hosts → write policy.json.draft (never silently opens the world)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from webclaw_x.policy_draft import draft_json  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="Draft WEBCLAW policy.json from host list")
    p.add_argument("--hosts", required=True, help="Comma/space separated hosts or URLs")
    p.add_argument("--out", default="", help="Write path (default: stdout)")
    p.add_argument("--no-localhost", action="store_true", help="Set allow_localhost false")
    args = p.parse_args()
    text = draft_json(args.hosts, allow_localhost=not args.no_localhost)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"wrote {path}", file=sys.stderr)
        print("Review, then: cp to $WEBCLAW_HOME/policy.json (deployer only).", file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
