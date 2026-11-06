"""Versioned recipes: immutable publish, env templates, legacy compatibility and safe data."""
from conftest import as_envelope
import asyncio
import json
import os
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from webclaw_x.recipe_library import RecipeLibrary, LibraryError
from webclaw_x import server as gw

BODY1 = '# fuel report\n打开{{base_url}}/table.html，等待1，采集表格'
BODY2 = '# fuel report\n打开{{base_url}}/table.html，等待2，采集表格'


def test_publish_two_versions_list_get_diff(tmp_path):
    lib = RecipeLibrary(tmp_path)
    first = lib.publish('fuel', BODY1, tags=['fixture', 'table'])
    second = lib.publish('fuel', BODY2, tags=['table'])
    assert (first['version'], second['version']) == (1, 2)
    assert first['read_only'] and second['read_only']
    assert [(r['name'], r['version']) for r in lib.list()] == [('fuel', 1), ('fuel', 2)]
    assert lib.get('fuel@1')['recipe'] == BODY1+'\n'
    assert lib.get('fuel')['version'] == 2
    delta = lib.diff('fuel@1', 'fuel@2')
    assert '-打开{{base_url}}/table.html，等待1' in delta
    assert '+打开{{base_url}}/table.html，等待2' in delta


def test_read_only_publish_and_integrity(tmp_path):
    lib = RecipeLibrary(tmp_path)
    lib.publish('fuel', BODY1)
    with pytest.raises(LibraryError, match='read-only'):
        lib.publish('fuel', BODY2, version=1)
    assert lib.get('fuel@1')['recipe'] == BODY1+'\n'
    file = tmp_path/'recipe-library/fuel/versions/1/recipe.webclaw'
    assert file.stat().st_mode & 0o222 == 0, 'published snapshot should not be writable accidentally'
    file.chmod(0o644)
    file.write_text('等待9')
    with pytest.raises(LibraryError) as e:
        lib.get('fuel@1')
    assert e.value.code == 'RECIPE_INTEGRITY_ERROR'


def test_env_binding_no_body_copy_and_precedence(tmp_path):
    lib = RecipeLibrary(tmp_path)
    lib.publish('fuel', BODY1, parameters={'base_url':'https://default.example.invalid'})
    path = tmp_path/'recipe-library/fuel/versions/1/recipe.webclaw'
    frozen = path.read_bytes()
    lib.bind_env('fuel', 'fixture', {'base_url':'http://127.0.0.1:8765'})
    lib.bind_env('fuel', 'mes-test', {'base_url':'https://mes-test.example.invalid'})
    assert lib.get('fuel@1', environment='fixture')['recipe'].startswith('# fuel report\n打开http://127.0.0.1:8765/')
    assert 'https://mes-test.example.invalid/table.html' in lib.get('fuel', environment='mes-test')['recipe']
    assert 'http://localhost:9999/' in lib.get('fuel', environment='fixture', parameters={'base_url':'http://localhost:9999'})['recipe']
    assert path.read_bytes() == frozen
    assert len(list((tmp_path/'recipe-library/fuel/versions').glob('*/recipe.webclaw'))) == 1


def test_legacy_flat_remains_compatible(tmp_path):
    flat = tmp_path/'recipes'
    flat.mkdir()
    old = flat/'fuel.webclaw'
    old.write_text('等待1\n')
    lib = RecipeLibrary(tmp_path)
    assert lib.get('fuel')['source'] == 'flat'
    lib.publish('fuel', BODY1)
    assert lib.get('fuel')['source'] == 'versioned'
    assert lib.get('fuel@legacy')['recipe'] == '等待1\n'
    assert {r['version'] for r in lib.list()} == {1, 'legacy'}
    assert old.read_text() == '等待1\n'


@pytest.mark.parametrize('name', ['../escape', '/tmp/x', 'a/b', '.', 'a@1'])
def test_name_traversal_rejected(tmp_path, name):
    with pytest.raises(LibraryError):
        RecipeLibrary(tmp_path).publish(name, '等待1')


@pytest.mark.parametrize('body,parameters', [
    ('输入密码=TEST-PASS', {}),
    ('打开https://test:FAKE-PASS@host.invalid', {}),
    ('等待1', {'password':'TEST-PASS'}),
    ('打开{{base_url}}', {'base_url':'https://host.invalid/?token=TEST-TOKEN'}),
    ('输入验证码={{captcha}}', {}),
])
def test_no_plaintext_secret_published(tmp_path, body, parameters):
    with pytest.raises(LibraryError) as e:
        RecipeLibrary(tmp_path).publish('unsafe', body, parameters=parameters)
    assert e.value.code == 'RECIPE_SECRET_REJECTED'
    assert not list(tmp_path.rglob('recipe.webclaw'))


def test_missing_environment_params_and_invalid_version(tmp_path):
    lib = RecipeLibrary(tmp_path)
    lib.publish('fuel', BODY1)
    for fn, code in [
        (lambda: lib.get('fuel@99'), 'RECIPE_NOT_FOUND'),
        (lambda: lib.get('fuel', environment='missing'), 'RECIPE_ENV_NOT_FOUND'),
        (lambda: lib.get('fuel', render=True), 'RECIPE_MISSING_PARAMS'),
        (lambda: lib.publish('fuel', BODY1, version='1.2.3'), 'RECIPE_INVALID_ARGS'),
        (lambda: lib.publish('fuel', BODY1, version=4), 'RECIPE_INVALID_ARGS'),
        (lambda: lib.bind_env('fuel', 'fixture', {'pwd':'FAKE'}), 'RECIPE_SECRET_REJECTED'),
    ]:
        with pytest.raises(LibraryError) as e: fn()
        assert e.value.code == code


def test_concurrent_publish_increments_without_overwrite(tmp_path):
    lib = RecipeLibrary(tmp_path)
    with ThreadPoolExecutor(max_workers=4) as pool:
        versions = list(pool.map(lambda i: lib.publish('concurrent', f'等待{i}')['version'], range(1, 5)))
    assert sorted(versions) == [1, 2, 3, 4]
    assert len(lib.list()) == 4


def test_cli_publish_freeze_list_get_diff(tmp_path):
    def cli(*args, ok=True):
        p = subprocess.run([sys.executable, '-m', 'webclaw_x.recipe_library', '--home', str(tmp_path), *args],
                           cwd=Path(__file__).resolve().parents[1], text=True, capture_output=True)
        result = json.loads(p.stdout)
        assert result['ok'] == ok, result
        assert (p.returncode == 0) == ok
        return result['data'] if ok else result
    file = tmp_path/'input.webclaw'
    file.write_text(BODY1)
    assert cli('publish', 'fuel', '--file', str(file), '--tags', 'fixture')['version'] == 1
    file.write_text(BODY2)
    assert cli('freeze', 'fuel', '--file', str(file))['version'] == 2
    assert len(cli('list')) == 2
    assert cli('get', 'fuel@1')['version'] == 1
    assert 'fuel@2' in cli('diff', 'fuel@1', 'fuel@2')
    cli('bind-env', 'fuel', 'fixture', '--params', '{"base_url":"http://localhost:8765"}')
    assert 'http://localhost:8765/table.html' in cli('get', 'fuel@2', '--env', 'fixture')['recipe']


def test_mcp_tools_and_versioned_fixture_replay(tmp_path, monkeypatch):
    monkeypatch.setattr(gw, 'HOME', tmp_path)
    monkeypatch.setenv('WEBCLAW_HOME', str(tmp_path))
    monkeypatch.setenv('WEBCLAW_HEADLESS', '1')
    monkeypatch.delenv('WEBCLAW_POLICY_FILE', raising=False)
    monkeypatch.delenv('WEBCLAW_POLICY_ENABLED', raising=False)
    for folder in ('recipes','runs','bin','jobs'): (tmp_path/folder).mkdir()
    binary = os.environ.get('WEBCLAW_LITE_BIN', '/home/box/.webclaw/bin/webclaw-lite')
    assert Path(binary).is_file()
    monkeypatch.setattr(gw, 'BINARY', binary)
    assert as_envelope(gw.webclaw_recipe_publish('demo', BODY1, tags=['fixture']))['data']['version'] == 1
    assert as_envelope(gw.webclaw_recipe_publish('demo', BODY2))['data']['version'] == 2
    assert len(as_envelope(gw.webclaw_recipe_list())['data']['recipes']) == 2
    assert as_envelope(gw.webclaw_recipe_get('demo@1'))['data']['version'] == 1
    assert '等待2' in as_envelope(gw.webclaw_recipe_diff('demo@1','demo@2'))['data']['diff']
    site = Path(__file__).resolve().parents[1]/'fixtures/site'
    httpd = ThreadingHTTPServer(('127.0.0.1',0), partial(SimpleHTTPRequestHandler,directory=str(site)))
    threading.Thread(target=httpd.serve_forever,daemon=True).start()
    try:
        params = json.dumps({'base_url':f'http://127.0.0.1:{httpd.server_port}'})
        assert as_envelope(gw.webclaw_recipe_bind_env('demo','fixture',params))['ok']
        out = as_envelope(asyncio.run(gw.webclaw_run(recipe_ref='demo@1', environment='fixture', params_confirmed=True, title='recipe-lib-fixture')))
        assert out['ok'] and out['done']['success'], out
        assert out['recipe_version']['version'] == 1
        assert out['recipe_version']['environment'] == 'fixture'
        assert list((Path(out['done']['run_dir'])/'documents').glob('*.tables.json'))
        # Binding a different host does NOT automatically add it to the runtime allowlist.
        assert as_envelope(gw.webclaw_recipe_bind_env('demo','mes-test','{"base_url":"https://mes-test.example.invalid"}'))['ok']
        denied = as_envelope(asyncio.run(gw.webclaw_run(recipe_ref='demo@2', environment='mes-test', params_confirmed=True)))
        assert denied['code'] == 'POLICY_DENIED', denied
        assert denied['done']['raw']['error_code'] == 'POLICY_DENIED'
    finally:
        httpd.shutdown(); httpd.server_close()
