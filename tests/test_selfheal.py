"""Real step-scoped self-heal ladder with deterministic local fixture signals."""
from conftest import as_envelope
import asyncio
import json
import os
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import pytest
from webclaw_x import server as gw, jobs

@pytest.fixture
def healing(tmp_path, monkeypatch):
    for d in ['runs','recipes','jobs','bin']: (tmp_path/d).mkdir()
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    monkeypatch.setattr(gw, 'BINARY', os.environ.get('WEBCLAW_LITE_BIN','/home/box/.webclaw/bin/webclaw-lite'))
    monkeypatch.setenv('WEBCLAW_HOME',str(tmp_path))
    monkeypatch.setenv('WEBCLAW_HEADLESS','1')
    for k in ['WEBCLAW_HEAL_FILE','WEBCLAW_HEAL_ENABLED','WEBCLAW_POLICY_FILE','WEBCLAW_POLICY_ENABLED','WEBCLAW_HUMAN_DIR']:
        monkeypatch.delenv(k, raising=False)
    def config(**kwargs):
        c={'enabled':True,'short_retries':0,'retry_interval_ms':100,'refresh':False,
           'structural_anchors':{},'hitl':False,'hitl_timeout_secs':30,'ai_hook_budget':0}
        c.update(kwargs)
        (tmp_path/'heal.json').write_text(json.dumps(c))
        return c
    return tmp_path,config

@pytest.fixture
def heal_site():
    site=Path(__file__).resolve().parents[1]/'fixtures/site'
    state={'ready':False,'loads':0}
    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path.startswith('/ready'):
                self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers()
                self.wfile.write(json.dumps({'ready':state['ready']}).encode())
                return
            if self.path.startswith('/selfheal.html'): state['loads']+=1
            super().do_GET()
        def log_message(self,*a): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(site)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try: yield f'http://127.0.0.1:{server.server_port}',state
    finally: server.shutdown();server.server_close()

def stages(out): return [x['stage'] for x in out.get('heal_trace',[])]

def run(base,mode,target='文字Recovered0.2'):
    return as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{base}/selfheal.html?mode={mode}，等待{target}，采集表格',title='selfheal-fixture')))

def test_short_retry_same_step_without_reopening(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(short_retries=1,retry_interval_ms=500)
    stop=threading.Event()
    def signal_after_failure():
        deadline=time.monotonic()+25
        while not stop.is_set() and time.monotonic()<deadline:
            with jobs._guard: active=list(jobs._jobs.values())
            for job in active:
                for line in job.stdout.splitlines():
                    try:
                        message=json.loads(line).get('message','')
                        if not message.startswith('SELF_HEAL '): continue
                        trace=json.loads(message[len('SELF_HEAL '):])
                    except (ValueError,AttributeError): continue
                    if trace.get('stage')=='short_retry':
                        state['ready']=True;return
            stop.wait(.02)
    thread=threading.Thread(target=signal_after_failure,daemon=True);thread.start()
    try: out=run(base,'retry')
    finally: stop.set();thread.join(timeout=1)
    assert out['ok'],out
    assert stages(out)==['short_retry'],out
    assert state['loads']==1,'must not replay earlier navigation step'
    assert out['done']['okCount']==3


def test_refresh_then_same_step(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(short_retries=1,refresh=True)
    out=run(base,'reload')
    assert out['ok'],out
    assert stages(out)==['short_retry','refresh']
    assert state['loads']==2,'exactly one explicit refresh, not whole-recipe restart'


def test_explicit_structural_anchor_only(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(structural_anchors={'等待 文字Never0.2':'按钮#1 1'})
    out=run(base,'fallback','文字Never0.2')
    assert out['ok'],out
    assert stages(out)==['structural_fallback']
    assert state['loads']==1


def test_exhausted_returns_need_repair_and_bounded_ai_hook(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(short_retries=2,refresh=True,ai_hook_budget=1)
    out=run(base,'permanent')
    assert not out['ok'] and out['code']=='NEED_REPAIR',out
    assert stages(out)==['short_retry','short_retry','refresh','need_repair','ai_hook_unimplemented']
    assert all(x['ai_hook']=={'budget':1,'used':0,'implemented':False} for x in out['heal_trace'])
    assert state['loads']==2


def test_hitl_resumes_and_rechecks_original_step(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(hitl=True)
    out=run(base,'human','文字Recovered1')
    assert out['code']=='NEED_HUMAN',out
    assert stages(out)==['need_repair','hitl']
    job=jobs.waiting(out['run_id'])
    try:
        # Synthetic fixture signal stands in for a user repairing the page.
        state['ready']=True
        time.sleep(.15)
        final=as_envelope(asyncio.run(gw.webclaw_human_reply(mode='ok',run_id=out['run_id'],prompt_id=out['need_human']['prompt_id'])))
        assert final['ok'],final
        assert final['done']['okCount']==3
        assert state['loads']==1
    finally:
        if job and job.proc.poll() is None:
            gw._run(['cancel'],timeout=10);job.collect()


def test_disabled_keeps_legacy_failure(healing,heal_site):
    _,config=healing;base,_=heal_site
    config(enabled=False,short_retries=3,refresh=True)
    out=run(base,'permanent')
    assert not out['ok'] and out['code']=='RUN_FAILED',out
    assert not out.get('heal_trace')


def test_policy_ambiguity_and_actions_are_not_retried(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(short_retries=3,refresh=True,hitl=True)
    denied=as_envelope(asyncio.run(gw.webclaw_run(recipe='打开https://not-allowed.invalid')))
    assert denied['code']=='POLICY_DENIED' and not denied.get('heal_trace')
    # Bare click defaults to #1 — succeeds, must not enter heal.
    ambiguous=as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{base}/ambiguous.html，点击确定')))
    assert ambiguous.get('ok') and not ambiguous.get('heal_trace'), ambiguous
    action=as_envelope(asyncio.run(gw.webclaw_run(recipe=f'打开{base}/selfheal.html，选择下拉 missing')))
    assert action['code']=='NEED_REPAIR',action
    assert stages(action)==['need_repair_unsafe_or_nontransient']
    assert state['loads']==1


def test_invalid_config_fails_closed(healing,heal_site):
    home,config=healing;base,state=heal_site
    config(short_retries=999)
    out=run(base,'permanent')
    assert out['code']=='HEAL_CONFIG_INVALID',out
    assert state['loads']==0,'invalid config must fail before navigation'


def test_hitl_acknowledgement_without_repair_is_not_success(healing,heal_site):
    _,config=healing;base,state=heal_site
    config(hitl=True)
    out=run(base,'human','文字Recovered0.2')
    assert out['code']=='NEED_HUMAN',out
    job=jobs.waiting(out['run_id'])
    try:
        final=as_envelope(asyncio.run(gw.webclaw_human_reply(mode='ok',run_id=out['run_id'],prompt_id=out['need_human']['prompt_id'])))
        assert final['code']=='NEED_REPAIR' and not final['ok'],final
        assert stages(final)==['need_repair','hitl','ai_hook_unimplemented']
        assert state['loads']==1
    finally:
        if job and job.proc.poll() is None:
            gw._run(['cancel'],timeout=10);job.collect()


def test_emergency_env_off_bypasses_bad_config(healing,heal_site,monkeypatch):
    home,_=healing;base,state=heal_site
    (home/'heal.json').write_text('{invalid-json')
    monkeypatch.setenv('WEBCLAW_HEAL_ENABLED','0')
    out=run(base,'permanent')
    assert not out['ok'] and out['code']=='RUN_FAILED',out
    assert not out.get('heal_trace') and state['loads']==1
