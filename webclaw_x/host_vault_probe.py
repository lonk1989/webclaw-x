"""Probe known Host vault export files and merge into the local webclaw vault.

Contract:
- Hosts write a local export (same machine); webclaw reads it on MCP / install start.
- Passwords never enter LLM prompts; this module must not log secret values.
- Missing paths → quiet skip. Corrupt / untrusted files → warn + skip that file.

Schema ``webclaw.host-vault.v1``::

    {
      "schema": "webclaw.host-vault.v1",
      "host": "fengxing",
      "exportedAt": "2026-11-09T00:00:00Z",
      "systems": [
        {"id": "ehr", "name": "EHR系统", "url": "https://…", "username": "u", "password": "…"}
      ],
      "signature": "<optional hex HMAC-SHA256 of body without signature>"
    }

Fengxing native store (``~/.dsh/storages/web-systems.json``) is also probed
(read-only) when present — shape ``{version:1, byUser:{…}}``.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

LOG = logging.getLogger("webclaw_x.host_vault_probe")

SCHEMA = "webclaw.host-vault.v1"
MAX_BYTES = 1_000_000
KNOWN_HOSTS = frozenset({"fengxing", "workbuddy", "doubao", "cursor", "generic"})


@dataclass
class ProbeResult:
    scanned: int = 0
    imported_files: int = 0
    ensured: int = 0
    credentials: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "imported_files": self.imported_files,
            "ensured": self.ensured,
            "credentials": self.credentials,
            "skipped": self.skipped,
            "errors": list(self.errors),
        }


def resolve_webclaw_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    env = (os.environ.get("WEBCLAW_HOME") or "").strip()
    if env:
        return Path(env)
    if sys.platform == "win32":
        local = (os.environ.get("LOCALAPPDATA") or "").strip()
        if local:
            return Path(local) / "webclaw"
        return Path.home() / "AppData" / "Local" / "webclaw"
    return Path.home() / ".webclaw"


def _local_app_data() -> Path:
    if sys.platform == "win32":
        local = (os.environ.get("LOCALAPPDATA") or "").strip()
        if local:
            return Path(local)
        return Path.home() / "AppData" / "Local"
    return Path.home() / ".local" / "share"


def known_export_paths(webclaw_home: Path | None = None) -> list[Path]:
    """Ordered candidate files. Missing files are fine."""
    home = resolve_webclaw_home(webclaw_home)
    local = _local_app_data()
    user = Path.home()
    dsh = Path(os.environ.get("DSH_HOME") or (user / ".dsh"))

    paths: list[Path] = []

    # Explicit override: WEBCLAW_HOST_VAULT_PATHS=path1;path2
    raw = (os.environ.get("WEBCLAW_HOST_VAULT_PATHS") or "").strip()
    if raw:
        for part in raw.replace(",", ";").split(";"):
            p = part.strip()
            if p:
                paths.append(Path(p))

    # Canonical drop directory under WEBCLAW_HOME
    export_dir = home / "host-exports"
    paths.extend(
        [
            export_dir / "fengxing.json",
            export_dir / "workbuddy.json",
            export_dir / "doubao.json",
            export_dir / "cursor.json",
            export_dir / "generic.json",
        ]
    )
    # Any extra *.json dropped by Hosts (still schema-gated)
    if export_dir.is_dir():
        for child in sorted(export_dir.glob("*.json")):
            paths.append(child)

    # Fengxing / DSH native store (plaintext Host vault; same-machine only)
    paths.append(dsh / "storages" / "web-systems.json")
    paths.append(local / "fengxing-desktop" / "dsh" / "storages" / "web-systems.json")
    paths.append(local / "fengxing" / "exports" / "webclaw-vault.json")

    # WorkBuddy / Doubao conventional export locations
    paths.append(user / ".workbuddy" / "webclaw-vault.json")
    paths.append(local / "WorkBuddy" / "webclaw-vault.json")
    paths.append(local / "DoubaoWork" / "webclaw-vault.json")
    paths.append(local / "doubao" / "webclaw-vault.json")

    # De-dupe while preserving order
    seen: set[str] = set()
    out: list[Path] = []
    for p in paths:
        key = str(p.resolve()) if p.exists() else str(p)
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def _file_looks_local_only(path: Path) -> bool:
    """Best-effort: skip world-writable files on POSIX; Windows always ok if readable."""
    try:
        st = path.stat()
    except OSError:
        return False
    if not path.is_file():
        return False
    if st.st_size <= 0 or st.st_size > MAX_BYTES:
        return False
    if sys.platform != "win32":
        mode = st.st_mode & 0o777
        if mode & 0o002:  # world-writable
            return False
    return True


def _hmac_key(webclaw_home: Path) -> bytes | None:
    key_path = webclaw_home / "host-vault.key"
    try:
        raw = key_path.read_bytes()
    except OSError:
        return None
    raw = raw.strip()
    if len(raw) < 16:
        return None
    return raw


def _verify_signature(doc: dict[str, Any], raw_text: str, webclaw_home: Path) -> bool:
    """If signature present, require matching HMAC; if absent, allow same-machine file."""
    sig = doc.get("signature")
    if not sig:
        return True
    if not isinstance(sig, str) or not sig.strip():
        return False
    key = _hmac_key(webclaw_home)
    if key is None:
        LOG.warning("host-vault: signature present but host-vault.key missing; skip")
        return False
    # Re-serialize without signature for stable verify when possible
    body = {k: v for k, v in doc.items() if k != "signature"}
    payload = json.dumps(body, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    expected = hmac.new(key, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected.lower(), sig.strip().lower())


def _normalize_system(row: dict[str, Any]) -> dict[str, str] | None:
    if not isinstance(row, dict):
        return None
    url = str(row.get("url") or "").strip()
    name = str(row.get("name") or "").strip()
    sid = str(row.get("id") or "").strip()
    if not url or (not name and not sid):
        return None
    return {
        "id": sid or name.lower().replace(" ", "-"),
        "name": name or sid,
        "url": url,
        "username": str(row.get("username") or "").strip(),
        "password": str(row.get("password") or ""),
    }


def parse_export_document(raw: str) -> list[dict[str, str]]:
    """Parse v1 export or fengxing byUser store into flat systems."""
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("root must be object")

    # Canonical export
    if data.get("schema") == SCHEMA:
        systems = data.get("systems")
        if not isinstance(systems, list):
            raise ValueError("systems must be array")
        out: list[dict[str, str]] = []
        for row in systems:
            n = _normalize_system(row if isinstance(row, dict) else {})
            if n:
                out.append(n)
        return out

    # Fengxing / corp-auth native store
    if data.get("version") == 1 and isinstance(data.get("byUser"), dict):
        out = []
        seen: set[str] = set()
        for _uid, rows in data["byUser"].items():
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                n = _normalize_system(row)
                if not n:
                    continue
                key = n["id"]
                if key in seen:
                    continue
                seen.add(key)
                out.append(n)
        return out

    # Flat {systems:[…]} without schema (lenient for early hosts)
    if isinstance(data.get("systems"), list) and "byUser" not in data:
        out = []
        for row in data["systems"]:
            n = _normalize_system(row if isinstance(row, dict) else {})
            if n:
                out.append(n)
        return out

    raise ValueError("unrecognized vault export shape")


def _lite_bin(webclaw_home: Path, explicit: str | None = None) -> Path | None:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    env = (os.environ.get("WEBCLAW_LITE_BIN") or "").strip()
    if env and Path(env).is_file():
        return Path(env)
    win = webclaw_home / "bin" / "webclaw-lite.exe"
    unix = webclaw_home / "bin" / "webclaw-lite"
    if win.is_file():
        return win
    if unix.is_file():
        return unix
    return None


def _run_lite(
    lite: Path,
    webclaw_home: Path,
    args: list[str],
    *,
    timeout: float = 60.0,
) -> bool:
    env = os.environ.copy()
    env["WEBCLAW_HOME"] = str(webclaw_home)
    env["WEBCLAW_LITE"] = "1"
    try:
        r = subprocess.run(
            [str(lite), *args],
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _apply_system(
    lite: Path | None,
    webclaw_home: Path,
    row: dict[str, str],
    result: ProbeResult,
) -> None:
    """Merge one system into vault via lite when available; else patch JSON urls only."""
    if lite is not None:
        ensure_args = [
            "accounts",
            "ensure",
            "--id",
            row["id"],
            "--url",
            row["url"],
            "--name",
            row["name"],
        ]
        if _run_lite(lite, webclaw_home, ensure_args):
            result.ensured += 1
        else:
            result.skipped += 1
            return
        if row["username"] and row["password"]:
            set_args = [
                "accounts",
                "set",
                "--id",
                row["id"],
                "--url",
                row["url"],
                "--name",
                row["name"],
                "--user",
                row["username"],
                "--password",
                row["password"],
            ]
            if _run_lite(lite, webclaw_home, set_args):
                result.credentials += 1
            else:
                result.skipped += 1
        return

    # No lite: best-effort URL/name patch into web-systems.json (no password encryption).
    path = webclaw_home / "web-systems.json"
    try:
        db: dict[str, Any] = {"systems": []}
        if path.is_file():
            db = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(db.get("systems"), list):
                db["systems"] = []
        systems: list[Any] = db["systems"]
        found = False
        for item in systems:
            if isinstance(item, dict) and str(item.get("id") or "") == row["id"]:
                item["url"] = row["url"]
                item["name"] = row["name"]
                if row["username"]:
                    item["username"] = row["username"]
                found = True
                break
        if not found:
            systems.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "kind": "internal",
                    "url": row["url"],
                    "username": row["username"],
                    "password": "",
                    "source": "host-vault-probe",
                }
            )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result.ensured += 1
        if row["password"]:
            result.skipped += 1  # cannot encrypt without lite
    except (OSError, json.JSONDecodeError, TypeError) as e:
        result.errors.append(f"patch {path.name}: {e}")
        result.skipped += 1


def probe_and_import(
    *,
    webclaw_home: Path | None = None,
    lite_bin: str | None = None,
    paths: Iterable[Path] | None = None,
    quiet: bool = True,
) -> ProbeResult:
    """Scan known Host export paths and merge into the vault. Never raises for missing files."""
    home = resolve_webclaw_home(webclaw_home)
    result = ProbeResult()
    lite = _lite_bin(home, lite_bin)
    candidates = list(paths) if paths is not None else known_export_paths(home)

    for path in candidates:
        result.scanned += 1
        try:
            if not path.is_file():
                continue
            if not _file_looks_local_only(path):
                result.skipped += 1
                if not quiet:
                    LOG.warning("host-vault: skip unsafe/oversized %s", path)
                continue
            raw = path.read_text(encoding="utf-8")
            # Pre-parse for signature gate on canonical schema
            try:
                doc = json.loads(raw)
            except json.JSONDecodeError as e:
                result.errors.append(f"{path.name}: invalid json ({e})")
                result.skipped += 1
                continue
            if isinstance(doc, dict) and doc.get("schema") == SCHEMA:
                host = str(doc.get("host") or "").strip().lower()
                if host and host not in KNOWN_HOSTS:
                    result.skipped += 1
                    continue
                if not _verify_signature(doc, raw, home):
                    result.errors.append(f"{path.name}: bad signature")
                    result.skipped += 1
                    continue
            systems = parse_export_document(raw)
            if not systems:
                continue
            result.imported_files += 1
            for row in systems:
                _apply_system(lite, home, row, result)
            if not quiet:
                LOG.info(
                    "host-vault: imported %s systems from %s",
                    len(systems),
                    path,
                )
        except Exception as e:  # noqa: BLE001 — probe must stay quiet
            result.errors.append(f"{path.name}: {e}")
            result.skipped += 1
            if not quiet:
                LOG.warning("host-vault: %s", e)

    if not quiet or result.imported_files:
        LOG.info(
            "host-vault: scanned=%s files=%s ensured=%s creds=%s skipped=%s",
            result.scanned,
            result.imported_files,
            result.ensured,
            result.credentials,
            result.skipped,
        )
    return result


def maybe_probe_on_startup(
    *,
    webclaw_home: Path | None = None,
    lite_bin: str | None = None,
) -> ProbeResult | None:
    """MCP/install entry: disabled with WEBCLAW_HOST_VAULT_PROBE=0."""
    if (os.environ.get("WEBCLAW_HOST_VAULT_PROBE") or "1").strip() in ("0", "false", "off", "no"):
        return None
    try:
        return probe_and_import(
            webclaw_home=webclaw_home,
            lite_bin=lite_bin,
            quiet=True,
        )
    except Exception as e:  # noqa: BLE001
        LOG.debug("host-vault probe suppressed: %s", e)
        return None


__all__ = [
    "SCHEMA",
    "ProbeResult",
    "known_export_paths",
    "parse_export_document",
    "probe_and_import",
    "maybe_probe_on_startup",
    "resolve_webclaw_home",
]
