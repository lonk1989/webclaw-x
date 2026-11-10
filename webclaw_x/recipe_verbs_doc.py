"""Install / copy the verb cookbook next to MCP fragments for every Host."""

from __future__ import annotations

from pathlib import Path

# Keep in sync with docs/recipe-verbs.md (short install-time copy).
RECIPE_VERBS_MD = """# webclaw 菜谱动词说明书

用户说的「打开 / 点击 / 采集 / 登录…」是**菜谱动词**。
正确：拼成一句菜谱 → 一次调用 `webclaw_run`。
错误：只查 accounts；`Start-Process` / 默认浏览器 / `open` / `xdg-open` 打开 URL；Playwright。

## 对照

| 用户说 | 你调用 |
|--------|--------|
| 打开 MES / 打开旧MES | `webclaw_run`，recipe=`打开旧MES系统` 或 `登录旧MES系统` |
| 打开 https://a.com | `webclaw_run`，recipe=`打开https://a.com` |
| 打开…，点确定，采集表格 | **一整句**一次 `webclaw_run` |
| 有哪些网站账号 | 才用 accounts 列表工具 |

查到保险箱 URL ≠ 已打开。禁止把 URL 丢给系统浏览器后说「已打开」。

## 动词

打开/open · 登录 · 点击/click · 输入/type · 等待/wait · 采集/collect · 刷新/reload · 截图/screenshot · 滚动/scroll · 按/press · 参数/param

示例：
```
打开旧MES系统，登录旧MES系统，等待5，点击工单，采集表格
```

等待（Agent）：只写「等待2/等待5」等秒数；禁止等待文字/加载/登录成功等目标。人手智能等待原样回放。

完整说明：https://github.com/lonk1989/webclaw-x/blob/main/docs/recipe-verbs.md
"""


def write_recipe_verbs_doc(mcp_dir: Path) -> Path:
    mcp_dir.mkdir(parents=True, exist_ok=True)
    path = mcp_dir / "RECIPE-VERBS.md"
    path.write_text(RECIPE_VERBS_MD.lstrip("\n"), encoding="utf-8")
    return path


__all__ = ["RECIPE_VERBS_MD", "write_recipe_verbs_doc"]
