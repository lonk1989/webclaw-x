from __future__ import annotations

from conftest import as_envelope
import json
from pathlib import Path

from webclaw_x.dualwrite import dualwrite_documents, extract_tables_from_markdown
from webclaw_x.scrub import scrub_obj, scrub_text


def test_scrub_inline_password():
    s = scrub_text("登录成功 password=SuperSecret123 继续")
    assert "SuperSecret123" not in s
    assert "***REDACTED***" in s


def test_scrub_captcha_and_cn():
    s = scrub_text("请输入 验证码=9482 后提交；密码=abc")
    assert "9482" not in s
    assert "abc" not in s


def test_scrub_obj_keys():
    obj = scrub_obj({"password": "x", "nested": {"captcha": "9999", "ok": True}})
    assert obj["password"] == "***REDACTED***"
    assert obj["nested"]["captcha"] == "***REDACTED***"
    assert obj["nested"]["ok"] is True


SAMPLE_MD = """# 页面采集

## 概览

| 项 | 内容 |
| --- | --- |
| 时间 | 2026-11-06 10:00:00 |
| 表格数 | 1 |

## 表格

### 加油记录

| 车牌 | 加油量(L) | 金额(元) |
| --- | --- | --- |
| 粤A12345 | 42.5 | 320.00 |
| 粤B67890 | 38.0 | 286.50 |

共 2 条（含表格行）。
"""


def test_extract_tables():
    tables = extract_tables_from_markdown(SAMPLE_MD)
    assert len(tables) >= 1
    t = tables[0]
    assert "车牌" in t["headers"]
    assert len(t["rows"]) == 2


def test_dualwrite(tmp_path: Path):
    docs = tmp_path / "documents"
    docs.mkdir()
    (docs / "页面采集-demo.md").write_text(SAMPLE_MD, encoding="utf-8")
    result = dualwrite_documents(tmp_path)
    assert any(name.endswith(".tables.json") for name in result["written"])
    assert any(name.endswith(".csv") for name in result["written"])
    payload = json.loads((docs / "页面采集-demo.tables.json").read_text(encoding="utf-8"))
    assert payload[0]["rows"][0][0] == "粤A12345"
