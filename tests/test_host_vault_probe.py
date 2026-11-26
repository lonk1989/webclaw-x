"""Host vault probe: schema parse + quiet skip + import without lite."""

from __future__ import annotations

import json
from pathlib import Path

from webclaw_x.host_vault_probe import (
    SCHEMA,
    parse_export_document,
    probe_and_import,
)


def test_parse_v1_export():
    raw = json.dumps(
        {
            "schema": SCHEMA,
            "host": "workbuddy",
            "systems": [
                {"id": "my-app", "name": "演示", "url": "https://app.example/", "username": "u"},
                {"id": "bad", "name": "", "url": ""},
            ],
        }
    )
    rows = parse_export_document(raw)
    assert len(rows) == 1
    assert rows[0]["id"] == "my-app"
    assert rows[0]["url"].startswith("https://")


def test_parse_fengxing_by_user_store():
    raw = json.dumps(
        {
            "version": 1,
            "byUser": {
                "u1": [
                    {
                        "id": "prod",
                        "name": "生产系统",
                        "url": "http://prod.example:18082/",
                        "username": "a",
                        "password": "secret",
                    }
                ]
            },
        }
    )
    rows = parse_export_document(raw)
    assert len(rows) == 1
    assert rows[0]["id"] == "prod"
    assert rows[0]["password"] == "secret"


def test_probe_missing_paths_is_quiet(tmp_path: Path):
    result = probe_and_import(
        webclaw_home=tmp_path,
        paths=[tmp_path / "nope.json"],
        quiet=True,
    )
    assert result.scanned == 1
    assert result.imported_files == 0
    assert result.errors == []


def test_probe_imports_url_without_lite(tmp_path: Path):
    export = tmp_path / "host-exports" / "fengxing.json"
    export.parent.mkdir(parents=True)
    export.write_text(
        json.dumps(
            {
                "schema": SCHEMA,
                "host": "fengxing",
                "systems": [
                    {
                        "id": "office",
                        "name": "办公系统",
                        "url": "http://office.example/",
                        "username": "bob",
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    result = probe_and_import(
        webclaw_home=tmp_path,
        paths=[export],
        lite_bin=None,
        quiet=True,
    )
    assert result.imported_files == 1
    assert result.ensured == 1
    vault = json.loads((tmp_path / "web-systems.json").read_text(encoding="utf-8"))
    assert vault["systems"][0]["id"] == "office"
    assert vault["systems"][0]["url"] == "http://office.example/"
