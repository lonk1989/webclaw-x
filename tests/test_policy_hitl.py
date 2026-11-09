"""P1 policy + real file-human-bridge tests; synthetic data only."""
from conftest import as_envelope
import asyncio
import json
import os
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import pytest
from webclaw_x import server as gw
from webclaw_x import jobs
from webclaw_x.scrub import scrub_obj, remember_sensitive

@pytest.fixture
def isolated(tmp_path, monkeypatch):
    for d in ('runs', 'recipes', 'jobs', 'bin'):
        (tmp_path / d).mkdir()
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    binary = Path(os.environ.get('WEBCLAW_LITE_BIN', '/home/box/.webclaw/bin/webclaw-lite'))
    assert binary.is_file(), 'integration requires built webclaw-lite'
    monkeypatch.setattr(gw, 'BINARY', str(binary))
    monkeypatch.setenv('WEBCLAW_HOME', str(tmp_path))
    monkeypatch.setenv('WEBCLAW_HEADLESS', '1')
    monkeypatch.delenv('WEBCLAW_HUMAN_DIR', raising=False)
    monkeypatch.delenv('WEBCLAW_POLICY_FILE', raising=False)
    monkeypatch.delenv('WEBCLAW_POLICY_ENABLED', raising=False)
    return tmp_path

@pytest.fixture
def local_url():
    site = Path(__file__).resolve().parents[1] / 'fixtures' / 'site'
    httpd = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(site)))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{httpd.server_port}/table.html'
    finally:
        httpd.shutdown()
        httpd.server_close()

def _enable_empty_allowlist(home: Path) -> None:
    """Opt-in fail-closed policy (product default is off)."""
    (home / 'policy.json').write_text(
        json.dumps({'enabled': True, 'allow_localhost': True, 'allowed_hosts': []}),
        encoding='utf-8',
    )


@pytest.mark.parametrize('verb', ['打开', 'open', '打开标签'])
def test_allowlist_denies_nonlisted_navigation(isolated, verb):
    # .invalid never resolves: runtime must deny before navigating/DNS.
    _enable_empty_allowlist(isolated)
    out = as_envelope(asyncio.run(gw.webclaw_run(recipe=f'{verb} https://denied.invalid/path', title='policy-deny')))
    assert not out['ok']
    assert out['code'] == 'POLICY_DENIED', out
    assert out['done']['raw']['error_code'] == 'POLICY_DENIED', out


def test_probe_cannot_bypass_policy(isolated):
    _enable_empty_allowlist(isolated)
    out = as_envelope(gw.webclaw_probe(url='https://denied.invalid'))
    assert not out['ok']
    assert out['code'] == 'POLICY_DENIED', out
    assert json.loads(out['data']['stdout_tail'])['error_code'] == 'POLICY_DENIED', out


def test_raw_cli_enforces_policy(isolated):
    _enable_empty_allowlist(isolated)
    p = subprocess.run([gw.BINARY, 'run', '--stdin'], input='打开https://denied.invalid',
                       env=gw._env(), capture_output=True, text=True, timeout=40)
    assert p.returncode != 0
    assert 'POLICY_DENIED' in p.stdout + p.stderr


def test_policy_off_by_default_allows_external(isolated):
    # No policy.json → default enabled:false → external URL not POLICY_DENIED at gate.
    # May still fail later on DNS/network; must not be POLICY_DENIED.
    out = as_envelope(asyncio.run(gw.webclaw_run(
        recipe='打开https://denied.invalid/path', title='policy-default-off')))
    assert out.get('code') != 'POLICY_DENIED', out


def test_localhost_still_works_without_policy_file(isolated, local_url):
    out = as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{local_url}，采集表格', title='policy-local')))
    assert out['ok'] and out['code'] == 'OK', out


def test_strict_policy_explicit_host_and_disable(isolated, local_url, monkeypatch):
    path = isolated / 'policy.json'
    path.write_text(json.dumps({'enabled': True, 'allow_localhost': False, 'allowed_hosts': []}))
    blocked = as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{local_url}')))
    assert blocked['code'] == 'POLICY_DENIED'
    # Exact whitelist config is live-read (no restart).
    path.write_text(json.dumps({'enabled': True, 'allow_localhost': False, 'allowed_hosts': ['127.0.0.1']}))
    allowed = as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{local_url}')))
    assert allowed['ok'], allowed
    # Disable switch exercised only with local test target.
    path.write_text(json.dumps({'enabled': True, 'allow_localhost': False, 'allowed_hosts': []}))
    monkeypatch.setenv('WEBCLAW_POLICY_ENABLED', '0')
    disabled = as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{local_url}')))
    assert disabled['ok'], disabled


def test_malformed_policy_fails_closed(isolated, local_url):
    (isolated / 'policy.json').write_text('{bad-json')
    out = as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{local_url}')))
    assert out['code'] == 'POLICY_DENIED', out


def test_hitl_live_resume_with_prompt_scoping_and_redaction(isolated, local_url):
    # Real runtime/file bridge, synthetic confirmation text, no external captcha.
    out = as_envelope(asyncio.run(gw.webclaw_run(
        recipe=f'打开{local_url}，人机验证30 fixture-confirmation，采集表格',
        title='hitl-live-fixture', dualwrite_tables=False)))
    job = jobs.waiting(out.get('run_id', ''))
    try:
        assert out['code'] == 'NEED_HUMAN', out
        assert out['need_human']['kind'] == 'human'
        rid = out['run_id']
        prompt_id = out['need_human']['prompt_id']
        assert job and job.proc.poll() is None, 'waiting child must stay alive'
        for bad in [dict(run_id='unknown'), dict(run_id=rid, prompt_id='stale')]:
            rejected = as_envelope(asyncio.run(gw.webclaw_human_reply(mode='ok', **bad)))
            assert rejected['code'] == 'NO_ACTIVE_HUMAN'
        fake_code = 'TEST-OTP-NOT-A-REAL-CODE-572914'
        resumed = asyncio.run(gw.webclaw_human_reply(mode='text', text=fake_code, run_id=rid, prompt_id=prompt_id))
        assert fake_code not in json.dumps(resumed, ensure_ascii=False)
        result = as_envelope(resumed)
        assert result['ok'] and result['code'] == 'OK', result
        assert result['done']['success']
        assert list((Path(result['done']['run_dir']) / 'documents').glob('*.md'))
        assert not (Path(result['done']['run_dir']) / 'human' / 'human_reply.txt').exists()
        assert as_envelope(asyncio.run(gw.webclaw_human_reply(mode='ok', run_id=rid)))['code'] == 'NO_ACTIVE_HUMAN'
    finally:
        if job and job.proc.poll() is None:
            gw._run(['cancel'], timeout=10)
            job.collect()


def test_hitl_unlabeled_and_jsonl_secrets_are_redacted():
    value = 'FAKE-OTP-REDACTION-ONLY'
    remember_sensitive(value)
    with patch.object(gw, '_run', return_value={'ok': True, 'code': 'OK', 'data': {
        'stdout': json.dumps({'type': 'log', 'message': value, 'password': 'TEST-PASS'})+'\n',
        'stderr': value, 'exit_code': 0}}):
        result = gw.webclaw_last_log()
    blob = json.dumps(as_envelope(result), ensure_ascii=False)
    assert value not in blob and 'TEST-PASS' not in blob
    assert 'REDACTED' in blob


def test_timeout_overrides_previous_human_event():
    out = as_envelope(gw._finalize({'ok': False, 'code': 'TIMEOUT', 'data': {
        'stdout': json.dumps({'type': 'need_human', 'kind': 'human'}),
        'stderr': '', 'exit_code': -9}}))
    assert not out['ok'] and out['code'] == 'TIMEOUT'
