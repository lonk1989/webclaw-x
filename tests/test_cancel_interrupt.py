"""Cancellation must interrupt children without blocking the MCP event loop."""
from conftest import as_envelope
import asyncio
import json
import os
from pathlib import Path
import signal
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock

import pytest

from webclaw_x import jobs, server as gw


@pytest.fixture(autouse=True)
def no_leaked_jobs():
    assert not jobs.has_active()
    yield
    jobs.cancel_active()
    with jobs._guard:
        assert not jobs._jobs


def wait_for_job():
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        with jobs._guard:
            active = [j for j in jobs._jobs.values() if j.proc.poll() is None]
            if active:
                return active[0]
        time.sleep(0.01)
    pytest.fail('child did not start')


def start_sleep(home, script='import time; time.sleep(30)'):
    return jobs.start([sys.executable, '-c', script],
                      {**os.environ, 'WEBCLAW_HOME': str(home)}, None, 5, False)


def test_cancel_interrupts_start_reaps_child_and_releases_slot(tmp_path):
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(start_sleep, tmp_path)
        job = wait_for_job()
        assert jobs.has_active() and jobs.active_job_ids() == [job.id]
        cancelled = jobs.cancel_active(job.id)
        result = future.result(timeout=2)
    assert cancelled['ok'] and cancelled['code'] == 'RUN_CANCELLED'
    assert cancelled['job_id'] == job.id
    assert not result['ok'] and result['code'] == 'RUN_CANCELLED'
    assert result['job_id'] == job.id
    assert job.proc.poll() is not None
    assert (tmp_path / 'control/cancel').read_text() == '1'
    assert not jobs.has_active() and not jobs._jobs
    # No stranded RUN_BUSY after cancellation, and cancelling twice is safe.
    assert jobs.cancel_active()['data']['cancelled'] is False
    next_run = start_sleep(tmp_path, 'pass')
    assert next_run['ok'] and next_run['code'] == 'OK'


def test_cancel_wrong_id_does_not_touch_active_job(tmp_path):
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(start_sleep, tmp_path)
        job = wait_for_job()
        try:
            result = jobs.cancel_active('not-the-active-job')
            assert result['ok'] and result['data']['cancelled'] is False
            assert job.proc.poll() is None
            assert not (tmp_path / 'control/cancel').exists()
        finally:
            jobs.cancel_active(job.id)
        assert future.result(timeout=2)['code'] == 'RUN_CANCELLED'


@pytest.mark.skipif(sys.platform == 'win32', reason='POSIX signal handling')
def test_cancel_escalates_to_kill_when_terminate_is_ignored(tmp_path):
    script = ('import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); '
              'print("ready", flush=True); time.sleep(30)')
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(start_sleep, tmp_path, script)
        job = wait_for_job()
        deadline = time.monotonic() + 2
        while 'ready' not in job.stdout and time.monotonic() < deadline:
            time.sleep(0.01)
        try:
            assert 'ready' in job.stdout
            assert jobs.cancel_active()['code'] == 'RUN_CANCELLED'
            assert future.result(timeout=2)['code'] == 'RUN_CANCELLED'
            assert job.proc.returncode == -signal.SIGKILL
        finally:
            jobs.cancel_active()


def test_cancel_still_terminates_when_marker_is_unwritable(tmp_path):
    # A file where a directory should be gives a reliable OSError even as root.
    (tmp_path / 'control').write_text('not a directory')
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(start_sleep, tmp_path)
        job = wait_for_job()
        result = jobs.cancel_active()
        assert result['ok'] and result['data']['cancel_marker_error']
        assert future.result(timeout=2)['code'] == 'RUN_CANCELLED'
        assert job.proc.poll() is not None


def test_cancel_wakes_need_human_collect_and_wins_over_stale_events(tmp_path):
    script = ('import json,time; print(json.dumps({"type":"need_human",'
              '"prompt_id":"synthetic"}), flush=True); time.sleep(30)')
    initial = start_sleep(tmp_path, script)
    assert initial['code'] == 'NEED_HUMAN'
    job = jobs._jobs[initial['job_id']]
    # Even if the old terminal event is already queued, cancellation is final.
    job.events.put({'type': 'done', 'ok': True})
    assert jobs.cancel_active(job.id)['code'] == 'RUN_CANCELLED'
    result = job.collect()
    assert not result['ok'] and result['code'] == 'RUN_CANCELLED'
    assert result['waiting'] is None and job.proc.poll() is not None
    assert not jobs._jobs


def test_async_run_and_cancel_share_live_event_loop(tmp_path, monkeypatch):
    real_start = jobs.start
    collected = threading.Event()
    release = threading.Event()
    worker_ids = []
    main_id = threading.get_ident()
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    monkeypatch.setattr(gw, 'BINARY', sys.executable)

    def sleeper(command, env, stdin_text, timeout, dualwrite):
        worker_ids.append(threading.get_ident())
        result = real_start([sys.executable, '-c', 'import time; time.sleep(30)'],
                            env, None, 5, False)
        collected.set()
        # Keep final delivery pending so ordering is deterministic: cancel must
        # return while run is still in flight, not wait for run's response.
        release.wait(timeout=3)
        return result

    def native_cancel(args, **kwargs):
        worker_ids.append(threading.get_ident())
        assert args == ['cancel']
        assert not jobs.has_active(), 'managed child must be stopped first'
        return {'ok': True, 'code': 'OK', 'data': {'stdout': '', 'exit_code': 0}}

    monkeypatch.setattr(gw.jobs, 'start', sleeper)
    monkeypatch.setattr(gw, '_run', native_cancel)

    async def scenario():
        task = asyncio.create_task(gw.webclaw_run(recipe='等待30'))
        try:
            # This coroutine must get CPU while jobs.start/collect are blocked.
            deadline = asyncio.get_running_loop().time() + 2
            while not jobs.has_active():
                assert not task.done(), 'run finished before cancel could be called'
                assert asyncio.get_running_loop().time() < deadline, 'event loop blocked'
                await asyncio.sleep(0.01)
            job = next(iter(jobs._jobs.values()))
            cancelled = as_envelope(await asyncio.wait_for(gw.webclaw_cancel(), timeout=2))
            assert cancelled['ok'] and cancelled['code'] == 'RUN_CANCELLED'
            assert cancelled['run_id'] == job.id
            assert cancelled['data']['native_cancel']['ok']
            assert not task.done(), 'cancel waited for the run response'
            assert job.proc.poll() is not None
            assert not jobs._jobs
            release.set()
            result = as_envelope(await asyncio.wait_for(task, timeout=2))
            assert not result['ok'] and result['code'] == 'RUN_CANCELLED'
        finally:
            release.set()
            await gw.webclaw_cancel()
            await task

    asyncio.run(asyncio.wait_for(scenario(), timeout=7))
    assert collected.is_set()
    assert worker_ids and all(tid != main_id for tid in worker_ids)


def test_async_human_reply_does_not_block_cancel(monkeypatch):
    collecting = threading.Event()
    release = threading.Event()
    worker_ids = []
    main_id = threading.get_ident()

    def collect():
        worker_ids.append(threading.get_ident())
        collecting.set()
        release.wait(timeout=3)
        return {'ok': False, 'code': 'RUN_CANCELLED', 'data': {}}

    job = Mock(run_dir='/synthetic/run', waiting=None, dualwrite=False)
    job.collect.side_effect = collect
    monkeypatch.setattr(jobs, 'waiting', Mock(return_value=job))
    monkeypatch.setattr(gw, '_run', Mock(return_value={'ok': True, 'code': 'OK', 'data': {}}))

    async def scenario():
        task = asyncio.create_task(gw.webclaw_human_reply(mode='ok', run_id='synthetic'))
        try:
            deadline = asyncio.get_running_loop().time() + 2
            while not collecting.is_set():
                assert asyncio.get_running_loop().time() < deadline
                await asyncio.sleep(0.01)
            assert not task.done(), 'reply collect blocked the event loop'
            result = as_envelope(await asyncio.wait_for(gw.webclaw_cancel(), timeout=1))
            assert result['ok']
        finally:
            release.set()
        assert as_envelope(await task)['code'] == 'RUN_CANCELLED'

    asyncio.run(asyncio.wait_for(scenario(), timeout=5))
    assert worker_ids and all(tid != main_id for tid in worker_ids)


def test_cancel_idle_returns_no_active_run_without_native_cli(monkeypatch, tmp_path):
    """Empty cancel must be NO_ACTIVE_RUN (not OK) and must not write global cancel."""
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    run = Mock(side_effect=AssertionError('idle cancel must not call native CLI'))
    monkeypatch.setattr(gw, '_run', run)
    result = as_envelope(asyncio.run(gw.webclaw_cancel()))
    assert result['ok'] and result['code'] == 'NO_ACTIVE_RUN'
    assert 'No matching gateway-managed run' in result['message']
    assert result['data'].get('cancelled') is False
    assert result['data'].get('native_cancel_skipped') is True
    run.assert_not_called()
    assert not (tmp_path / 'control/cancel').exists()


def test_cancel_stale_run_id_matches_idle_code(monkeypatch, tmp_path):
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    run = Mock(side_effect=AssertionError('stale cancel must not call native CLI'))
    monkeypatch.setattr(gw, '_run', run)
    result = as_envelope(asyncio.run(gw.webclaw_cancel(run_id='stale-id-xyz')))
    assert result['ok'] and result['code'] == 'NO_ACTIVE_RUN'
    assert result['data'].get('cancelled') is False
    run.assert_not_called()
    assert not (tmp_path / 'control/cancel').exists()


@pytest.mark.parametrize('event', [
    {'type': 'done', 'ok': 1, 'fail': 0},
    {'type': 'done', 'fail': 1, 'error_code': 'POLICY_DENIED'},
    {'type': 'need_human', 'kind': 'human'},
])
def test_cancel_code_is_authoritative_over_stale_output(event):
    result = as_envelope(gw._finalize({'ok': False, 'code': 'RUN_CANCELLED',
                                    'message': 'cancelled', 'data': {
        'stdout': json.dumps(event), 'stderr': 'AMBIGUOUS_TARGET', 'exit_code': -15}}))
    assert not result['ok'] and result['code'] == 'RUN_CANCELLED'


def test_same_stdio_session_can_cancel_inflight_run(tmp_path):
    """Real FastMCP dispatch/stdio, synthetic lite CLI (no browser required)."""
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    binary = tmp_path / 'fake-lite'
    binary.write_text(f'#!{sys.executable}\n' + '''import json, os, pathlib, sys, time
home = pathlib.Path(os.environ['WEBCLAW_HOME'])
if sys.argv[1] == 'run':
    recipe = sys.stdin.read()
    (home / 'child.pid').write_text(str(os.getpid()))
    if 'quick' not in recipe:
        time.sleep(30)
    print(json.dumps({'type': 'done', 'ok': 1, 'fail': 0}), flush=True)
elif sys.argv[1] == 'cancel':
    (home / 'control').mkdir(parents=True, exist_ok=True)
    (home / 'control/cancel').write_text('1')
    print(json.dumps({'type': 'cancel_requested'}), flush=True)
''')
    binary.chmod(0o755)
    params = StdioServerParameters(
        command=sys.executable, args=['-m', 'webclaw_x.server'],
        cwd=str(Path(__file__).resolve().parents[1]), env={
            **os.environ, 'WEBCLAW_HOME': str(tmp_path), 'WEBCLAW_LITE_BIN': str(binary),
            'WEBCLAW_RUN_TIMEOUT_MS': '5000',
        })

    async def call(session, name, args=None):
        result = await session.call_tool(name, arguments=args or {})
        assert not result.isError, result
        return json.loads(result.content[0].text)

    async def scenario():
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                task = asyncio.create_task(call(session, 'webclaw_run', {'recipe': '等待30'}))
                try:
                    deadline = asyncio.get_running_loop().time() + 2
                    while not (tmp_path / 'child.pid').exists():
                        assert not task.done()
                        assert asyncio.get_running_loop().time() < deadline
                        await asyncio.sleep(0.01)
                    assert not task.done()
                    # Independent call proves the actual FastMCP loop is free.
                    listing = await asyncio.wait_for(call(session, 'webclaw_list_recipes'), timeout=1)
                    assert listing['ok'] and not task.done()
                    cancelled = await asyncio.wait_for(call(session, 'webclaw_cancel'), timeout=2)
                    assert cancelled['ok'] and cancelled['code'] == 'RUN_CANCELLED'
                    result = await asyncio.wait_for(task, timeout=2)
                    assert not result['ok'] and result['code'] == 'RUN_CANCELLED'
                    child_pid = int((tmp_path / 'child.pid').read_text())
                    with pytest.raises(ProcessLookupError):
                        os.kill(child_pid, 0)
                    # Child slot really released, not just its MCP response hidden.
                    again = await call(session, 'webclaw_run', {'recipe': 'quick'})
                    assert again['ok'] and again['code'] == 'OK'
                finally:
                    if not task.done():
                        await call(session, 'webclaw_cancel')
                        await task

    asyncio.run(asyncio.wait_for(scenario(), timeout=10))
