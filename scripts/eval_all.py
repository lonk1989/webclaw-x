#!/usr/bin/env python3
"""Serial fixture-only regression dashboard; shared CDP must not run in parallel."""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'eval/out'
SUITES = (
    ('L1', 'eval_smoke.py', 'latest.json'),
    ('components', 'eval_components.py', 'components.json'),
    ('policy', 'eval_policy.py', 'policy.json'),
    ('recipe_lib', 'eval_recipe_lib.py', 'recipe-library.json'),
    ('selfheal', 'eval_selfheal.py', 'selfheal.json'),
    ('L2', 'l2_mcp_client.py', 'l2-client.json'),
)
TZ = ZoneInfo('Asia/Shanghai')


def counts(report: dict) -> dict:
    """Normalize numeric reports and pytest verbose-row reports without duplicates."""
    result = {key: 0 for key in ('passed', 'failed', 'skipped', 'xfailed', 'xpassed')}
    statuses = {'PASSED': 'passed', 'FAILED': 'failed', 'ERROR': 'failed',
                'SKIPPED': 'skipped', 'XFAIL': 'xfailed', 'XPASS': 'xpassed'}
    for line in report.get('tests', []):
        match = re.search(r'\s(PASSED|FAILED|ERROR|SKIPPED|XFAIL|XPASS)(?:\s+\[[^\]]*\])?$', line)
        if match:
            result[statuses[match[1]]] += 1
    for key in result:
        if key in report:
            value = report[key]
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f'invalid {key} count')
            result[key] = value
    return result


def normalized(report: dict, exit_code: int) -> dict:
    result = counts(report)
    source = report.get('status')
    if exit_code or source not in ('green', 'yellow') or result['failed']:
        status = 'red'
    elif source == 'yellow' or any(result[k] for k in ('skipped', 'xfailed', 'xpassed')):
        status = 'yellow'
    elif result['passed'] == 0:
        status = 'red'  # A zero-test run is not a successful regression.
    else:
        status = 'green'
    return dict(result, status=status, source_status=source, exit_code=exit_code)


def report_signature(path: Path):
    try:
        stat = path.stat()
        return (stat.st_mtime_ns, stat.st_size, stat.st_ino)
    except FileNotFoundError:
        return None


def run_suite(name: str, script: str, filename: str, python: str, stamp: str) -> dict:
    report_path = OUT / filename
    log_path = OUT / f'dashboard-{stamp}-{name}.log'
    command = [python, str(ROOT / 'scripts' / script)]
    before = report_signature(report_path)
    started = time.perf_counter()
    error = None
    exit_code = -1
    env = os.environ.copy()
    env.setdefault('WEBCLAW_HEADLESS', '1')
    env['PYTHONPATH'] = str(ROOT) + (os.pathsep + env['PYTHONPATH'] if env.get('PYTHONPATH') else '')
    with log_path.open('w', encoding='utf-8') as log:
        try:
            proc = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log,
                                    stderr=subprocess.STDOUT, start_new_session=True)
            try:
                exit_code = proc.wait(timeout=600)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
                error = 'suite timeout (600s); process group stopped'
        except OSError as exc:
            error = f'cannot start suite: {exc}'
    fresh = report_signature(report_path)
    result = dict(passed=0, failed=0, skipped=0, xfailed=0, xpassed=0, status='red', exit_code=exit_code)
    if fresh is None or fresh == before:
        error = error or 'report missing or stale; previous green report was not reused'
    elif error is None:
        try:
            result = normalized(json.loads(report_path.read_text(encoding='utf-8')), exit_code)
        except (OSError, ValueError, TypeError, AttributeError) as exc:
            error = f'invalid report: {exc}'
    result.update(name=name, duration_seconds=round(time.perf_counter() - started, 3),
                  report=str(report_path.relative_to(ROOT)), report_fresh=fresh is not None and fresh != before,
                  log=str(log_path.relative_to(ROOT)), command=command)
    if error:
        result.update(status='red', error=error)
    return result


def write_dashboard(data: dict) -> None:
    path = OUT / 'dashboard.json'
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)
    rows = ['# 总回归看板', '', f"状态：{data['status']} · Asia/Shanghai", '',
            '| Suite | Status | Passed | Failed | Seconds | Report |',
            '|---|---|---:|---:|---:|---|']
    for suite in data['suites']:
        report = suite['report'].removeprefix('eval/out/')
        rows.append(f"| {suite['name']} | {suite['status']} | {suite['passed']} | {suite['failed']} | {suite['duration_seconds']} | [{report}]({report}) |")
    rows += ['', '合计为各套件执行计数，L1 与专项用例有重叠，非去重。',
             '共享 CDP：串行执行；请勿同时运行独立 eval。', '']
    (OUT / 'dashboard.md').write_text('\n'.join(rows), encoding='utf-8')


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    # Prevent two dashboards from concurrently using CDP or overwriting reports.
    with (OUT / '.eval-all.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another eval_all is running; leave its dashboard untouched.', file=sys.stderr)
            return 2
        started = time.perf_counter()
        now = datetime.now(TZ)
        python = ROOT / '.venv/bin/python'
        python = str(python) if python.is_file() else sys.executable
        stamp = now.strftime('%Y%m%d-%H%M%S-%f')
        data = dict(status='running', started_at=now.isoformat(), timezone='Asia/Shanghai',
                    note='Sequential shared-CDP runs; totals include overlapping L1/specialist cases.', suites=[])
        write_dashboard(data)
        for name, script, report in SUITES:
            print(f'[{name}] running {script}', flush=True)
            suite = run_suite(name, script, report, python, stamp)
            data['suites'].append(suite)
            write_dashboard(data)
            print(f"[{name}] {suite['status']}: {suite['passed']} passed / {suite['failed']} failed ({suite['duration_seconds']}s)", flush=True)
        data['totals'] = {key: sum(s[key] for s in data['suites'])
                          for key in ('passed', 'failed', 'skipped', 'xfailed', 'xpassed')}
        data['totals']['failed_suites'] = sum(s['status'] == 'red' for s in data['suites'])
        data['status'] = ('red' if data['totals']['failed_suites'] else
                          'yellow' if any(s['status'] == 'yellow' for s in data['suites']) else 'green')
        data.update(finished_at=datetime.now(TZ).isoformat(), duration_seconds=round(time.perf_counter() - started, 3))
        write_dashboard(data)
        print(json.dumps({k: data[k] for k in ('status', 'totals', 'duration_seconds')}, ensure_ascii=False))
        print(f'DASHBOARD={OUT / "dashboard.json"}')
        return 0 if data['status'] == 'green' else 1


if __name__ == '__main__':
    raise SystemExit(main())
