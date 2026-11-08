"""Host contract regressions: gate before spawn, unified discovery, structured errors."""
from conftest import as_envelope
import asyncio
import json
from pathlib import Path
from unittest.mock import Mock

import pytest
from webclaw_x import server as gw
from webclaw_x.recipe_library import RecipeLibrary


@pytest.fixture
def gateway(tmp_path, monkeypatch):
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    monkeypatch.setattr(gw, 'BINARY', __file__)
    start = Mock(return_value={'ok': True, 'code': 'OK', 'data': {
        'stdout': '{"type":"done","ok":1,"fail":0}', 'exit_code': 0}})
    run = Mock(side_effect=AssertionError('gate/discovery must not start lite'))
    monkeypatch.setattr(gw.jobs, 'start', start)
    monkeypatch.setattr(gw, '_run', run)
    return tmp_path, start, run


def recipe_args(home, source, body):
    if source == 'body':
        return {'recipe': body}
    if source == 'ref':
        RecipeLibrary(home).publish('fixture', body, parameters={'delay': '1'})
        return {'recipe_ref': 'fixture@1'}
    (home / 'recipes').mkdir()
    path = home / 'recipes/fixture.webclaw'
    path.write_text(body)
    if source == 'path':
        return {'recipe_path': str(path)}
    return {'recipe_path': 'fixture'}


@pytest.mark.parametrize('source', ['body', 'path', 'stem', 'ref'])
@pytest.mark.parametrize('confirmed', [False, True])
def test_placeholder_confirmation_before_spawn(gateway, source, confirmed):
    home, start, run = gateway
    args = recipe_args(home, source, '等待{{delay}}')
    out = as_envelope(asyncio.run(gw.webclaw_run(**args, params='{"delay":"1"}', params_confirmed=confirmed)))
    if not confirmed:
        assert not out['ok'] and out['code'] == 'PARAMS_UNCONFIRMED'
        assert out['data']['pending_parameters'] == ['delay']
        assert 'delay' in out['message']
        start.assert_not_called()
        run.assert_not_called()
    else:
        assert out['ok'], out
        start.assert_called_once()


@pytest.mark.parametrize('source', ['body', 'path', 'stem', 'ref'])
@pytest.mark.parametrize('confirmed', [False, True])
def test_no_placeholders_needs_no_confirmation(gateway, source, confirmed):
    home, start, _ = gateway
    args = recipe_args(home, source, '等待1')
    assert as_envelope(asyncio.run(gw.webclaw_run(**args, params_confirmed=confirmed)))['ok']
    start.assert_called_once()


def test_absent_confirmation_lists_unique_names(gateway):
    _, start, _ = gateway
    out = as_envelope(asyncio.run(gw.webclaw_run(recipe='打开{{ base_url }}，等待{{delay}}，等待{{delay}}')))
    assert out['code'] == 'PARAMS_UNCONFIRMED'
    assert out['data']['pending_parameters'] == ['base_url', 'delay']
    start.assert_not_called()


def test_confirmation_does_not_bypass_missing_library_parameters(gateway):
    home, start, _ = gateway
    RecipeLibrary(home).publish('missing', '等待{{delay}}')
    out = as_envelope(asyncio.run(gw.webclaw_run(recipe_ref='missing@1', params_confirmed=True)))
    assert out['code'] == 'RECIPE_MISSING_PARAMS'
    start.assert_not_called()


def test_path_runs_checked_snapshot(gateway):
    home, start, _ = gateway
    path = home / 'snapshot.webclaw'
    path.write_text('等待1')
    assert as_envelope(asyncio.run(gw.webclaw_run(recipe_path=str(path))))['ok']
    command, _, stdin, *_ = start.call_args.args
    assert '--stdin' in command and '--recipe' not in command
    assert stdin == '等待1'


def test_unreadable_path_fails_closed(gateway):
    _, start, run = gateway
    out = as_envelope(asyncio.run(gw.webclaw_run(recipe_path='not-found')))
    assert out['code'] == 'RECIPE_MISSING'
    start.assert_not_called()
    run.assert_not_called()


def test_both_listing_tools_merge_flat_and_published(gateway):
    home, start, run = gateway
    lib = RecipeLibrary(home)
    assert as_envelope(gw.webclaw_recipe_publish('fixture', '等待{{delay}}', tags=['test'],
                                              parameters='{"delay":"1"}'))['ok']
    lib.publish('fixture', '等待2')
    (home / 'recipes').mkdir()
    flat = home / 'recipes/fixture.webclaw'
    flat.write_text('# 旧菜谱\n等待{{delay}}')
    before = flat.read_bytes()
    old = as_envelope(gw.webclaw_list_recipes())
    new = as_envelope(gw.webclaw_recipe_list())
    assert old['ok'] and old['data']['recipes'] == new['data']['recipes']
    rows = {row['id']: row for row in old['data']['recipes']}
    assert set(rows) == {'fixture@1', 'fixture@2', 'fixture@legacy'}
    assert rows['fixture@1']['source'] == 'library'
    assert rows['fixture@1']['tags'] == ['test']
    assert rows['fixture@1']['parameters_summary'] == {'placeholders': ['delay'], 'defaults': ['delay']}
    assert rows['fixture@legacy']['source'] == 'flat'
    assert rows['fixture@legacy']['path'] == str(flat)
    assert rows['fixture@legacy']['title'] == '旧菜谱'
    import hashlib
    raw = before  # bytes before list; content unchanged
    assert rows['fixture@legacy']['sha256'] == hashlib.sha256(raw).hexdigest()
    assert rows['fixture@legacy']['bytes'] == len(raw)
    # Legacy Hosts still see CLI JSONL under stdout_tail.
    assert json.loads(old['data']['stdout_tail'])['items'] == list(rows.values())
    assert flat.read_bytes() == before
    start.assert_not_called()
    run.assert_not_called()


def finalize(events, stderr='', raw_code='RUN_FAILED', ok=False, exit_code=1):
    return as_envelope(gw._finalize({'ok': ok, 'code': raw_code, 'data': {
        'stdout': '\n'.join(json.dumps(event) for event in events),
        'stderr': stderr, 'exit_code': exit_code}}))


@pytest.mark.parametrize('code', ['AMBIGUOUS_TARGET', 'POLICY_DENIED', 'TIMEOUT'])
def test_structured_done_code_without_chinese_or_regex(code, monkeypatch):
    monkeypatch.setattr(gw, '_legacy_error', Mock(side_effect=AssertionError('no fallback needed')))
    out = finalize([{'type': 'done', 'ok': 0, 'fail': 1, 'error_code': code, 'error': 'neutral detail'}])
    assert not out['ok'] and out['code'] == code


def test_structured_error_event_and_nested_noise():
    out = finalize([[], 123, {'type': {}}, {'type': 'error', 'error_code': 'POLICY_DENIED', 'error': 'neutral'}])
    assert out['code'] == 'POLICY_DENIED'


def test_structured_done_takes_precedence_over_step_and_chinese_logs():
    out = finalize([{'type': 'step_fail', 'error_code': 'TIMEOUT'},
                    {'type': 'log', 'message': '匹配到 2 个；POLICY_DENIED'},
                    {'type': 'done', 'fail': 1, 'error_code': 'AMBIGUOUS_TARGET'}])
    assert out['code'] == 'AMBIGUOUS_TARGET'


def test_success_ignores_recovered_step_failure():
    out = finalize([{'type': 'step_fail', 'error_code': 'TIMEOUT'},
                    {'type': 'done', 'ok': 2, 'fail': 0}], ok=True, raw_code='OK', exit_code=0)
    assert out['ok'] and out['code'] == 'OK'


def test_nonzero_exit_cannot_be_hidden_by_success_done():
    out = finalize([{'type': 'done', 'ok': 1, 'fail': 0}])
    assert not out['ok'] and out['code'] == 'RUN_FAILED'


def test_unknown_structured_code_is_not_promoted():
    out = finalize([{'type': 'done', 'fail': 1, 'error_code': 'PAGE_INVENTED_CODE'}])
    assert out['code'] == 'RUN_FAILED'


def test_watchdog_timeout_wins_over_structured_failure():
    out = finalize([{'type': 'done', 'fail': 1, 'error_code': 'AMBIGUOUS_TARGET'}], raw_code='TIMEOUT')
    assert out['code'] == 'TIMEOUT' and not out['ok']


@pytest.mark.parametrize('message, code', [
    ('AMBIGUOUS_TARGET: localized detail', 'AMBIGUOUS_TARGET'),
    ('POLICY_DENIED: localized detail', 'POLICY_DENIED'),
    ('共 2 个足够匹配，请加 #序号', 'AMBIGUOUS_TARGET'),
])
def test_old_binary_fallback_preserved(message, code):
    out = finalize([{'type': 'done', 'fail': 1, 'error': message}])
    assert out['code'] == code


def test_unknown_structured_code_is_not_overridden_by_log_prose():
    out = finalize([{'type': 'done', 'fail': 1, 'error_code': 'FUTURE_CODE'}], stderr='POLICY_DENIED')
    assert out['code'] == 'RUN_FAILED'


def test_boolean_success_cannot_hide_structured_failure():
    out = finalize([{'type': 'done', 'ok': True, 'fail': 0, 'error_code': 'TIMEOUT'}],
                   ok=True, raw_code='OK', exit_code=0)
    assert not out['ok'] and out['code'] == 'TIMEOUT'


def test_error_event_cannot_hide_behind_zero_exit():
    out = finalize([{'type': 'error', 'error_code': 'POLICY_DENIED'}],
                   ok=True, raw_code='OK', exit_code=0)
    assert not out['ok'] and out['code'] == 'POLICY_DENIED'


def test_watchdog_real_child_timeout_without_log_inference(tmp_path, monkeypatch):
    import os
    import sys
    from webclaw_x import jobs
    monkeypatch.setattr(gw, '_legacy_error', Mock(side_effect=AssertionError('watchdog is authoritative')))
    raw = jobs.start([sys.executable, '-c', 'import time; time.sleep(5)'],
                     {**os.environ, 'WEBCLAW_HOME': str(tmp_path)}, None, 0.1, False)
    out = as_envelope(gw._finalize(raw))
    assert not out['ok'] and out['code'] == 'TIMEOUT'
    assert out['data']['exit_code'] is not None


@pytest.mark.parametrize('pretty,prefix', [(False, ''), (True, ''), (False, 'diagnostic\n')])
def test_status_primary_fields_are_structured(monkeypatch, pretty, prefix):
    monkeypatch.setenv('WEBCLAW_STATUS_MODE', 'lite')  # exercise CLI path; fast covered elsewhere
    status = {'bin': 'synthetic', 'chrome': '/synthetic/chrome', 'chromeOk': True,
              'version': 'test', 'product': 'webclaw-lite', 'password': 'FAKE-PASSWORD'}
    monkeypatch.setattr(gw, '_run', Mock(return_value={'ok': True, 'code': 'OK', 'data': {
        'stdout': prefix + json.dumps(status, indent=2 if pretty else None), 'exit_code': 0}}))
    encoded = gw.webclaw_status()
    out = as_envelope(encoded)
    assert out['ok'] and out['data']['bin'] == 'synthetic'
    assert out['data']['chromeOk'] is True and out['data']['version'] == 'test'
    assert 'stdout_tail' in out['data']  # deprecated compatibility only
    assert 'FAKE-PASSWORD' not in json.dumps(out, ensure_ascii=False)


@pytest.mark.parametrize('stdout', ['not json', '[]', 'null'])
def test_invalid_status_is_explicit_failure(monkeypatch, stdout):
    monkeypatch.setenv('WEBCLAW_STATUS_MODE', 'lite')
    monkeypatch.setattr(gw, '_run', Mock(return_value={'ok': True, 'code': 'OK',
                                                       'data': {'stdout': stdout, 'exit_code': 0}}))
    out = as_envelope(gw.webclaw_status())
    assert not out['ok'] and out['code'] == 'RUN_FAILED'


def test_status_missing_binary_retains_error_envelope(monkeypatch):
    monkeypatch.setenv('WEBCLAW_STATUS_MODE', 'lite')
    monkeypatch.setattr(gw, '_run', Mock(return_value={'ok': False, 'code': 'BINARY_MISSING', 'data': {}}))
    out = as_envelope(gw.webclaw_status())
    assert not out['ok'] and out['code'] == 'BINARY_MISSING'

def test_ambiguous_envelope_parses_readable_candidates():
    err = (
        'AMBIGUOUS_TARGET:「确定」匹配到 3 个候选，请加 #序号（例如 点击确定#1）。'
        '候选：#1 button「确定」旁「对话框 A」主文档@(120,80) 硬可点；'
        '#2 button「确定」旁「对话框 B」主文档@(120,180) 硬可点；'
        '#3 button「确定」旁「对话框 C」主文档@(120,280) 硬可点'
    )
    out = finalize([{'type': 'done', 'ok': 2, 'fail': 1, 'error_code': 'AMBIGUOUS_TARGET', 'error': err}])
    assert out['code'] == 'AMBIGUOUS_TARGET'
    amb = out['ambiguous']
    assert amb['candidate_count'] == 3
    assert len(amb['candidates']) == 3
    assert amb['candidates'][0]['n'] == 1
    assert '对话框 A' in amb['candidates'][0]['label']
    assert '点击确定#1' in amb['hint']
    assert '点击文字#N' not in amb['hint']



def test_assert_report_hoisted_into_data_envelope():
    raw = {
        "ok": True,
        "code": "OK",
        "data": {
            "stdout": json.dumps({
                "type": "done", "ok": 1, "fail": 0, "success": True,
                "assert_report": "/tmp/断言报告-demo.md",
            }),
            "stderr": "",
            "exit_code": 0,
        },
    }
    # _finalize expects done.success for ok path when done present
    out = as_envelope(gw._finalize(raw))
    # done may flip ok based on success field
    assert out["data"].get("assert_report") == "/tmp/断言报告-demo.md"


def test_cancel_idle_unified_no_active_run(monkeypatch, tmp_path):
    import asyncio
    monkeypatch.setattr(gw, "HOME", tmp_path)
    monkeypatch.setattr(gw, "_run", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no native")))
    out = as_envelope(asyncio.run(gw.webclaw_cancel()))
    assert out["code"] == "NO_ACTIVE_RUN" and out["ok"] is True
    assert out["data"].get("native_cancel_skipped") is True
