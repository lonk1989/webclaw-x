"""Real child/process/stdio regressions; no browser, passwords or external sites."""
from conftest import as_envelope
import asyncio
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

import pytest
from webclaw_x import jobs, server as gw

ROOT = Path(__file__).resolve().parents[1]


def eventually(predicate, seconds=5):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(0.01)
    pytest.fail('lifecycle condition did not become true')


def records(home):
    return list((home / 'jobs').glob('*.json'))


def quick(home, script='pass', timeout=2):
    return jobs.start([sys.executable, '-c', script],
                      {**os.environ, 'WEBCLAW_HOME': str(home)}, None, timeout, False)


def record(home, pid, *, pgid=None, **overrides):
    directory = home / 'jobs'
    directory.mkdir(exist_ok=True)
    info = jobs._process_info(pid)
    row = dict(id='external-job', pid=pid, pgid=pgid, owner_pid=pid,
               process_start=info[2] if info else None, started_at='synthetic',
               recipe='synthetic', status='running', home=str(home),
               cancel_marker=str(directory / 'external-job.cancel'))
    row.update(overrides)
    path = directory / 'external-job.json'
    path.write_text(json.dumps(row))
    return path, row


@pytest.fixture
def sleeper():
    child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'],
                             start_new_session=True)
    yield child
    if child.poll() is None:
        os.killpg(child.pid, signal.SIGKILL)
    child.wait(timeout=3)


def test_foreign_record_cancel_terminates_and_cleans(tmp_path, sleeper, monkeypatch):
    path, row = record(tmp_path, sleeper.pid, pgid=sleeper.pid)
    monkeypatch.setenv('WEBCLAW_HOME', str(tmp_path))
    assert not jobs._jobs
    out = jobs.cancel_active(row['id'])
    assert out['ok'] and out['code'] == 'RUN_CANCELLED'
    assert out['job_id'] == row['id'] and out['data']['cancelled']
    assert sleeper.wait(timeout=2) == -signal.SIGTERM
    assert not path.exists() and not Path(row['cancel_marker']).exists()
    assert (tmp_path / 'control/cancel').read_text() == '1'
    assert jobs.cancel_active()['code'] == 'NO_ACTIVE_RUN'
    assert quick(tmp_path)['ok']
    assert not records(tmp_path)
    assert not (tmp_path / 'control/cancel').exists()


def test_foreign_record_blocks_start(tmp_path, sleeper):
    path, _ = record(tmp_path, sleeper.pid, pgid=sleeper.pid)
    out = quick(tmp_path)
    assert out['code'] == 'RUN_BUSY' and not out['ok']
    assert path.exists() and sleeper.poll() is None
    assert jobs.cancel_active(home=tmp_path)['code'] == 'RUN_CANCELLED'
    assert quick(tmp_path)['ok']


def test_dead_pid_is_cleaned_and_start_allowed(tmp_path):
    path, _ = record(tmp_path, 2**30)
    assert quick(tmp_path)['ok']
    assert not path.exists() and not records(tmp_path)


def test_recycled_pid_is_not_signalled(tmp_path, sleeper):
    path, _ = record(tmp_path, sleeper.pid, process_start='not-the-same-process')
    assert jobs.cancel_active(home=tmp_path)['code'] == 'NO_ACTIVE_RUN'
    assert not path.exists() and sleeper.poll() is None
    assert quick(tmp_path)['ok']


@pytest.mark.parametrize('script,timeout,code', [
    ('pass', 2, 'OK'), ('raise SystemExit(7)', 2, 'RUN_FAILED'),
    ('import time; time.sleep(30)', .1, 'TIMEOUT'),
])
def test_terminal_paths_cleanup(tmp_path, script, timeout, code):
    out = quick(tmp_path, script, timeout)
    assert out['code'] == code
    assert not records(tmp_path) and not jobs._jobs


def test_need_human_metadata_and_watchdog_cleanup_without_collector(tmp_path):
    # The Host returns after NEED_HUMAN and never replies; watchdog still cleans.
    out = quick(tmp_path, 'import json,time; print(json.dumps({"type":"need_human"}), '
                         'flush=True); time.sleep(30)', .4)
    assert out['code'] == 'NEED_HUMAN'
    row = json.loads(records(tmp_path)[0].read_text())
    assert set(('id', 'pid', 'pgid', 'started_at', 'recipe', 'status', 'home', 'cancel_marker')) <= row.keys()
    assert row['status'] == 'need_human' and row['pgid'] == row['pid']
    assert row['recipe'] == 'command'  # never command args/recipe body
    assert (records(tmp_path)[0].stat().st_mode & 0o777) == 0o600
    job = jobs._jobs[out['job_id']]
    eventually(lambda: not records(tmp_path) and not jobs._jobs)
    assert job.collect()['code'] == 'TIMEOUT'


def test_corrupt_record_fails_closed_without_signalling(tmp_path, sleeper):
    path, row = record(tmp_path, sleeper.pid, pgid=os.getpgrp())
    assert quick(tmp_path)['code'] == 'INTERNAL'
    assert jobs.cancel_active(home=tmp_path)['code'] == 'INTERNAL'
    assert sleeper.poll() is None and path.exists()
    path.write_text('{broken')
    assert quick(tmp_path)['code'] == 'INTERNAL'


def test_wrong_id_and_home_do_not_cancel_someone_else(tmp_path, sleeper, monkeypatch):
    record(tmp_path, sleeper.pid, pgid=sleeper.pid)
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    native = []
    monkeypatch.setattr(gw, '_run', lambda *a, **k: native.append(a))
    out = as_envelope(asyncio.run(gw.webclaw_cancel(run_id='stale')))
    assert out['code'] == 'NO_ACTIVE_RUN' and not out['data']['cancelled']
    assert sleeper.poll() is None and not native
    other = tmp_path / 'other'
    assert quick(other)['ok']  # exclusion is per home, not machine-global
    assert jobs.cancel_active(home=other)['code'] == 'NO_ACTIVE_RUN'
    assert sleeper.poll() is None
    out = as_envelope(asyncio.run(gw.webclaw_cancel(run_id='external-job')))
    assert out['code'] == 'RUN_CANCELLED' and out['data']['cancelled']
    assert not native  # no late global native cancel poisoning a subsequent run


OWNER = r"""
import json, os, sys, time
from pathlib import Path
from webclaw_x import jobs
home = Path(sys.argv[1])
if len(sys.argv) > 3:
    while not Path(sys.argv[3]).exists():
        time.sleep(.005)
result = jobs.start([sys.executable, '-c', 'import time; time.sleep(30)'],
                    {**os.environ, 'WEBCLAW_HOME': str(home)}, None, 12, False)
Path(sys.argv[2]).write_text(json.dumps(result))
"""


def test_real_other_gateway_cancel_propagates_to_original_collector(tmp_path):
    output = tmp_path / 'result.json'
    # result file is outside jobs/, so it cannot be mistaken for metadata.
    owner = subprocess.Popen([sys.executable, '-c', OWNER, str(tmp_path), str(output)], cwd=ROOT)
    try:
        path = eventually(lambda: next(iter(records(tmp_path)), None))
        row = json.loads(path.read_text())
        assert row['owner_pid'] == owner.pid and row['pid'] != owner.pid
        assert quick(tmp_path)['code'] == 'RUN_BUSY'
        assert jobs.cancel_active(row['id'], home=tmp_path)['code'] == 'RUN_CANCELLED'
        owner.wait(timeout=3)
        original = json.loads(output.read_text())
        assert original['code'] == 'RUN_CANCELLED' and not original['ok']
        assert original['job_id'] == row['id']
        assert not records(tmp_path) and not list((tmp_path / 'jobs').glob('*.cancel'))
        assert quick(tmp_path)['ok']
    finally:
        jobs.cancel_active(home=tmp_path)
        if owner.poll() is None:
            owner.kill()
        owner.wait(timeout=3)


def test_simultaneous_process_starts_have_one_winner(tmp_path):
    barrier = tmp_path / 'go'
    outputs = [tmp_path / f'result-{i}.json' for i in range(2)]
    owners = [subprocess.Popen([sys.executable, '-c', OWNER, str(tmp_path), str(out), str(barrier)],
                              cwd=ROOT) for out in outputs]
    try:
        barrier.touch()
        losing_file = eventually(lambda: next((p for p in outputs if p.exists()), None))
        loser = json.loads(losing_file.read_text())
        assert loser['code'] == 'RUN_BUSY'
        assert len(records(tmp_path)) == 1
        assert jobs.cancel_active(home=tmp_path)['code'] == 'RUN_CANCELLED'
        for owner in owners:
            assert owner.wait(timeout=3) == 0
        assert sorted(json.loads(p.read_text())['code'] for p in outputs) == ['RUN_BUSY', 'RUN_CANCELLED']
        assert not records(tmp_path)
    finally:
        jobs.cancel_active(home=tmp_path)
        for owner in owners:
            if owner.poll() is None:
                owner.kill()
            owner.wait(timeout=3)


def test_remote_cancel_escalates_and_kills_descendant_group(tmp_path):
    ready = tmp_path / 'ready'
    script = ("import subprocess,sys,signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); "
              "child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)']); "
              f"open({str(ready)!r},'w').write(str(child.pid)); time.sleep(30)")
    child = subprocess.Popen([sys.executable, '-c', script], start_new_session=True)
    try:
        eventually(ready.exists)
        descendant = int(ready.read_text())
        path, _ = record(tmp_path, child.pid, pgid=child.pid)
        assert jobs.cancel_active(home=tmp_path)['code'] == 'RUN_CANCELLED'
        assert child.wait(timeout=2) == -signal.SIGKILL
        assert not jobs._pid_alive(descendant) and not path.exists()
    finally:
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGKILL)
        child.wait(timeout=3)


def test_two_real_stdio_sessions_busy_then_targeted_cancel(tmp_path):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    binary = tmp_path / 'fake-lite'
    binary.write_text(f'#!{sys.executable}\n' + """import json,sys,time
if sys.argv[1] == 'run':
    recipe = sys.stdin.read()
    if recipe != 'quick':
        time.sleep(30)
    print(json.dumps({'type':'done','ok':1,'fail':0}), flush=True)
elif sys.argv[1] == 'status':
    print(json.dumps({'bin':'synthetic','chromeOk':True,'version':'test'}))
""")
    binary.chmod(0o755)
    params = StdioServerParameters(command=sys.executable, args=['-m', 'webclaw_x.server'],
        cwd=str(ROOT), env={**os.environ, 'WEBCLAW_HOME':str(tmp_path),
                           'WEBCLAW_LITE_BIN':str(binary), 'WEBCLAW_RUN_TIMEOUT_MS':'8000'})

    async def call(session, name, args=None):
        out = await session.call_tool(name, arguments=args or {})
        assert not out.isError, out
        return json.loads(out.content[0].text)

    async def scenario():
        async with stdio_client(params) as (r1, w1), stdio_client(params) as (r2, w2):
            async with ClientSession(r1, w1) as first, ClientSession(r2, w2) as second:
                await first.initialize()
                await second.initialize()
                task = asyncio.create_task(call(first, 'webclaw_run', {'recipe':'long'}))
                try:
                    deadline = asyncio.get_running_loop().time() + 3
                    while not records(tmp_path):
                        assert not task.done() and asyncio.get_running_loop().time() < deadline
                        await asyncio.sleep(.01)
                    row = json.loads(records(tmp_path)[0].read_text())
                    assert (await call(second, 'webclaw_run', {'recipe':'quick'}))['code'] == 'RUN_BUSY'
                    assert (await call(second, 'webclaw_status'))['data']['chromeOk'] is True
                    assert (await call(second, 'webclaw_list_recipes'))['data']['recipes'] == []
                    out = await call(second, 'webclaw_cancel', {'run_id':row['id']})
                    assert out['code'] == 'RUN_CANCELLED' and out['run_id'] == row['id']
                    assert (await asyncio.wait_for(task, 3))['code'] == 'RUN_CANCELLED'
                    assert not records(tmp_path)
                    assert (await call(second, 'webclaw_run', {'recipe':'quick'}))['ok']
                finally:
                    if not task.done():
                        await call(second, 'webclaw_cancel')
                        await task
    asyncio.run(asyncio.wait_for(scenario(), 15))
