"""Parse Markdown tables from collect reports and dual-write JSON/CSV.

Runtime currently only emits Markdown under runs/*/documents/.
P0: dual-write at MCP gateway after a successful run.
TODO(rust): move this into page_collect.rs alongside format_collect_markdown
so JSON/CSV are first-class artifacts without host-side parsing.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

_TABLE_SPLIT = re.compile(r"\n(?=## )")


def _parse_md_table(block: str) -> dict[str, Any] | None:
    lines = [ln.rstrip() for ln in block.strip().splitlines() if ln.strip()]
    # Find header | --- | row pattern
    header_idx = None
    for i, ln in enumerate(lines):
        if ln.startswith("|") and i + 1 < len(lines) and re.match(r"^\|\s*-+", lines[i + 1]):
            header_idx = i
            break
    if header_idx is None:
        return None
    headers = [c.strip() for c in lines[header_idx].strip("|").split("|")]
    rows: list[list[str]] = []
    for ln in lines[header_idx + 2 :]:
        if not ln.startswith("|"):
            break
        cells = [c.strip() for c in ln.strip("|").split("|")]
        # pad / trim
        if len(cells) < len(headers):
            cells += [""] * (len(headers) - len(cells))
        rows.append(cells[: len(headers)])
    title = ""
    for ln in lines[:header_idx]:
        if ln.startswith("## "):
            title = ln[3:].strip()
            break
        if ln.startswith("### "):
            title = ln[4:].strip()
            break
    return {"title": title or "table", "headers": headers, "rows": rows}


def extract_tables_from_markdown(md: str) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    # Prefer sections under ## 表格
    parts = _TABLE_SPLIT.split(md)
    for part in parts:
        if part.lstrip().startswith("## 表格") or part.lstrip().startswith("##表格"):
            # may contain multiple ### tables
            sub = re.split(r"\n(?=### )", part)
            for block in sub:
                t = _parse_md_table(block)
                if t and t["headers"] and (
                    t["rows"] or t["title"] not in ("概览",)
                ):
                    # skip the tiny overview meta table if nested oddly
                    if t["headers"] == ["项", "内容"]:
                        continue
                    tables.append(t)
        else:
            t = _parse_md_table(part)
            if t and t["headers"] and t["headers"] != ["项", "内容"] and t["rows"]:
                tables.append(t)
    # Fallback: any markdown table with rows that isn't 项|内容
    if not tables:
        for m in re.finditer(
            r"(\|[^\n]+\|\n\|\s*[-:| ]+\|\n(?:\|[^\n]+\|\n?)+)", md
        ):
            t = _parse_md_table(m.group(1))
            if t and t["headers"] != ["项", "内容"] and t["rows"]:
                tables.append(t)
    return tables


def dualwrite_documents(run_dir: str | Path) -> dict[str, Any]:
    """Scan documents/*.md and write sibling .json / .csv for each data table found."""
    root = Path(run_dir)
    docs = root / "documents"
    result: dict[str, Any] = {"run_dir": str(root), "written": [], "skipped": []}
    if not docs.is_dir():
        result["skipped"].append("no documents/ dir")
        return result
    for md_path in sorted(docs.glob("*.md")):
        text = md_path.read_text(encoding="utf-8", errors="replace")
        tables = extract_tables_from_markdown(text)
        if not tables:
            result["skipped"].append(str(md_path.name))
            continue
        stem = md_path.stem
        json_path = docs / f"{stem}.tables.json"
        json_path.write_text(
            json.dumps(tables, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        result["written"].append(str(json_path.name))
        for i, table in enumerate(tables):
            suffix = "" if len(tables) == 1 else f".{i + 1}"
            csv_path = docs / f"{stem}{suffix}.csv"
            with csv_path.open("w", encoding="utf-8", newline="") as f:
                w = csv.writer(f)
                w.writerow(table["headers"])
                w.writerows(table["rows"])
            result["written"].append(str(csv_path.name))
    return result
