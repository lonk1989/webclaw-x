"""Immutable local recipe versions + shared non-secret environment bindings.

Linux-only advisory publish locks; no dependency on MCP or Rust at import time.
"""
from __future__ import annotations
import argparse
import difflib
import fcntl
import hashlib
import json
import os
import re
import shutil
import tempfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

_NAME = re.compile(r'[\w][\w.-]{0,79}\Z', re.UNICODE)
_PARAM = re.compile(r'[\w][\w.-]{0,79}\Z', re.UNICODE)
_PLACEHOLDER = re.compile(r'\{\{\s*([\w.-]+)\s*\}\}')
_SECRET_KEY = re.compile(r'password|passwd|(^|_)pwd($|_)|secret|token|authorization|api[_-]?key|credential|captcha|验证码|密码|(^|_)otp($|_)', re.I)
_SECRET_LITERAL = re.compile(r'(?:password|passwd|pwd|secret|token|authorization|api[_-]?key|captcha|验证码|密码|\botp)\s*[=:：]', re.I)

class LibraryError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _fail(code, message):
    raise LibraryError(code, message)


def _name(value: str) -> str:
    if not isinstance(value, str) or not _NAME.fullmatch(value) or '..' in value:
        _fail('RECIPE_INVALID_ARGS', 'name must be a short identifier; no path separators or traversal')
    return value


def _secret_check(text: str):
    if _SECRET_LITERAL.search(text):
        _fail('RECIPE_SECRET_REJECTED', 'Inline credentials/verification codes are not accepted; use the vault/HITL')
    for match in re.finditer(r'https?://[^\s，；<>"\']+', text, re.I):
        try:
            u = urlsplit(match.group())
            if u.username is not None or u.password is not None:
                _fail('RECIPE_SECRET_REJECTED', 'Credentials embedded in URLs are forbidden')
        except ValueError as exc:
            if isinstance(exc, LibraryError): raise
            _fail('RECIPE_INVALID_ARGS', 'Invalid URL in recipe or environment')
    if any(_SECRET_KEY.search(k) for k in _PLACEHOLDER.findall(text)):
        _fail('RECIPE_SECRET_REJECTED', 'Secret placeholders are unsupported; use the runtime vault/HITL')


def _parameters(value) -> dict[str, str]:
    if not isinstance(value, dict):
        _fail('RECIPE_INVALID_ARGS', 'parameters must be a JSON object of strings')
    result = {}
    for key, item in value.items():
        if not isinstance(key, str) or not _PARAM.fullmatch(key):
            _fail('RECIPE_INVALID_ARGS', 'Invalid parameter name')
        if _SECRET_KEY.search(key):
            _fail('RECIPE_SECRET_REJECTED', 'Secret parameter keys are forbidden')
        if not isinstance(item, str) or any(c in item for c in '\n\r\x00'):
            _fail('RECIPE_INVALID_ARGS', 'Parameter values must be single-line strings')
        _secret_check(item)
        if key == 'base_url':
            try:
                u = urlsplit(item)
                if u.scheme not in ('http', 'https') or not u.hostname or u.username is not None:
                    _fail('RECIPE_INVALID_ARGS', 'base_url must be an http/https URL without credentials')
                _ = u.port
            except ValueError as exc:
                if isinstance(exc, LibraryError): raise
                _fail('RECIPE_INVALID_ARGS', 'Invalid base_url')
        result[key] = item
    return result


def _json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        _fail('RECIPE_INTEGRITY_ERROR', 'Cannot read recipe-library JSON')


def _dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


class RecipeLibrary:
    def __init__(self, home: str | Path | None = None):
        self.home = Path(home or os.environ.get('WEBCLAW_HOME') or Path.home()/'.webclaw').resolve()
        self.root = self.home / 'recipe-library'
        self.legacy = self.home / 'recipes'

    def _path(self, *parts):
        path = self.root.joinpath(*parts)
        if not path.resolve().is_relative_to(self.root.resolve()):
            _fail('RECIPE_INVALID_ARGS', 'Recipe path escapes library root')
        return path

    @contextmanager
    def _lock(self, name):
        series = self._path(_name(name))
        series.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(series/'.publish.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'a+') as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            yield series

    def _versions(self, name):
        directory = self._path(_name(name), 'versions')
        if not directory.is_dir(): return []
        return sorted(int(p.name) for p in directory.iterdir()
                      if p.is_dir() and not p.is_symlink() and p.name.isdecimal() and int(p.name) > 0)

    def publish(self, name, recipe, *, tags=None, parameters=None, version=None):
        name = _name(name)
        if not isinstance(recipe, str) or not recipe.strip():
            _fail('RECIPE_INVALID_ARGS', 'Non-empty recipe body required')
        _secret_check(recipe)
        params = _parameters(parameters if parameters is not None else {})
        tags = tags if tags is not None else []
        if not isinstance(tags, list) or not all(isinstance(t, str) and t and len(t) <= 80 for t in tags):
            _fail('RECIPE_INVALID_ARGS', 'tags must be a list of short non-empty strings')
        for tag in tags: _secret_check(tag)
        body = recipe.strip()+'\n'
        with self._lock(name) as series:
            versions = self._versions(name)
            latest = max(versions, default=0)
            if version is None or version == '':
                version = latest+1
            elif isinstance(version, bool) or not str(version).isdecimal() or int(version) < 1:
                _fail('RECIPE_INVALID_ARGS', 'Version must be a positive integer')
            version = int(version)
            if version in versions:
                _fail('RECIPE_VERSION_EXISTS', 'Published version is read-only; publish a new version')
            if version != latest+1:
                _fail('RECIPE_INVALID_ARGS', 'Version must be the next increasing integer')
            directory = self._path(name, 'versions')
            directory.mkdir(exist_ok=True)
            meta = {
                'name': name, 'version': version, 'tags': sorted(set(tags)),
                'read_only': True, 'parameters': params,
                'placeholders': sorted(set(_PLACEHOLDER.findall(body))),
                'sha256': hashlib.sha256(body.encode()).hexdigest(),
                'created_at': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
            }
            staging = Path(tempfile.mkdtemp(prefix='.publish-', dir=directory))
            try:
                (staging/'recipe.webclaw').write_text(body, encoding='utf-8')
                _dump(staging/'metadata.json', meta)
                for file in staging.iterdir(): file.chmod(0o444)
                os.rename(staging, directory/str(version))
            finally:
                if staging.exists(): shutil.rmtree(staging)
        return meta

    def bind_env(self, name, environment, parameters):
        name, environment = _name(name), _name(environment)
        params = _parameters(parameters)
        with self._lock(name) as series:
            if not self._versions(name):
                _fail('RECIPE_NOT_FOUND', 'Publish the recipe before binding environments')
            target = self._path(name, 'environments.json')
            bindings = _json(target) if target.exists() else {}
            if not isinstance(bindings, dict):
                _fail('RECIPE_INTEGRITY_ERROR', 'Invalid environment bindings')
            bindings[environment] = params
            fd, temp_name = tempfile.mkstemp(prefix='.env-', dir=series)
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    json.dump(bindings, f, ensure_ascii=False, indent=2)
                    f.write('\n')
                os.replace(temp_name, target)
            finally:
                if os.path.exists(temp_name): os.unlink(temp_name)
        return {'name': name, 'environment': environment, 'parameters': params}

    def get(self, reference, *, environment='', parameters=None, render=False):
        if not isinstance(reference, str): _fail('RECIPE_INVALID_ARGS', 'reference must be a string')
        name, sep, version = reference.rpartition('@')
        if not sep: name, version = reference, ''
        name = _name(name)
        versions = self._versions(name)
        if not version: version = str(max(versions)) if versions else 'legacy'
        if version == 'legacy':
            path = self.legacy / f'{name}.webclaw'
            if not path.resolve().is_relative_to(self.legacy.resolve()) or not path.is_file():
                _fail('RECIPE_NOT_FOUND', 'Legacy recipe not found')
            body = path.read_text(encoding='utf-8')
            meta = {'name': name, 'version': 'legacy', 'tags': [], 'read_only': False, 'parameters': {}}
            source = 'flat'
        else:
            if not version.isdecimal() or int(version) not in versions:
                _fail('RECIPE_NOT_FOUND', 'Recipe version not found')
            version = int(version)
            folder = self._path(name, 'versions', str(version))
            body_path = self._path(name, 'versions', str(version), 'recipe.webclaw')
            body = body_path.read_text(encoding='utf-8')
            meta = _json(self._path(name, 'versions', str(version), 'metadata.json'))
            if (not isinstance(meta, dict) or meta.get('name') != name or meta.get('version') != version
                    or meta.get('sha256') != hashlib.sha256(body.encode()).hexdigest()):
                _fail('RECIPE_INTEGRITY_ERROR', 'Recipe version content/metadata checksum mismatch')
            source = 'versioned'
        # Existing flat files stay untouched, but unsafe legacy material is not echoed/run by the new API.
        _secret_check(body)
        values = _parameters(meta.get('parameters', {}))
        env_path = self._path(name, 'environments.json')
        envs = _json(env_path) if env_path.exists() else {}
        if not isinstance(envs, dict): _fail('RECIPE_INTEGRITY_ERROR', 'Invalid environments JSON')
        if environment:
            environment = _name(environment)
            if environment not in envs: _fail('RECIPE_ENV_NOT_FOUND', 'Environment binding not found')
            values.update(_parameters(envs[environment]))
        values.update(_parameters(parameters if parameters is not None else {}))
        if render or environment or parameters:
            missing = sorted(set(_PLACEHOLDER.findall(body))-values.keys())
            if missing: _fail('RECIPE_MISSING_PARAMS', 'Missing template parameters: '+', '.join(missing))
            body = _PLACEHOLDER.sub(lambda m: values[m.group(1)], body)
            _secret_check(body)
        return {**meta, 'source': source, 'recipe': body, 'environment': environment or None,
                'environments': sorted(envs),
                'rendered_sha256': hashlib.sha256(body.encode()).hexdigest() if (render or environment or parameters) else None,
                'resolved_parameters': values if (render or environment or parameters) else {}}

    def list(self):
        rows = []
        if self.root.is_dir():
            for series in sorted(self.root.iterdir()):
                if not series.is_dir() or series.is_symlink(): continue
                name = _name(series.name)
                env_file = self._path(name, 'environments.json')
                envs = _json(env_file) if env_file.exists() else {}
                for version in self._versions(name):
                    meta = _json(self._path(name, 'versions', str(version), 'metadata.json'))
                    rows.append({**meta, 'source': 'versioned', 'environments': sorted(envs)})
        if self.legacy.is_dir():
            for path in sorted(self.legacy.glob('*.webclaw')):
                if not path.resolve().is_relative_to(self.legacy.resolve()): continue
                rows.append({'name': path.stem, 'version': 'legacy', 'tags': [], 'source': 'flat', 'read_only': False})
        return rows

    def diff(self, left, right):
        a, b = self.get(left), self.get(right)
        return ''.join(difflib.unified_diff(a['recipe'].splitlines(keepends=True), b['recipe'].splitlines(keepends=True),
                                            fromfile=f"{a['name']}@{a['version']}", tofile=f"{b['name']}@{b['version']}"))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', default=None, help='WEBCLAW_HOME; default ~/.webclaw')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('list')
    pub = sub.add_parser('publish', aliases=['freeze'])
    pub.add_argument('name'); pub.add_argument('--file', required=True)
    pub.add_argument('--version'); pub.add_argument('--tags', default='')
    pub.add_argument('--params', default='{}', help='JSON non-secret default parameters')
    get = sub.add_parser('get'); get.add_argument('reference')
    get.add_argument('--env', default=''); get.add_argument('--params', default='{}')
    bind = sub.add_parser('bind-env'); bind.add_argument('name'); bind.add_argument('environment')
    bind.add_argument('--params', required=True)
    diff = sub.add_parser('diff'); diff.add_argument('left'); diff.add_argument('right')
    args = parser.parse_args(argv)
    lib = RecipeLibrary(args.home)
    try:
        if args.command == 'list': result = lib.list()
        elif args.command in ('publish', 'freeze'):
            result = lib.publish(args.name, Path(args.file).read_text(encoding='utf-8'),
                                 tags=[t.strip() for t in args.tags.split(',') if t.strip()],
                                 parameters=json.loads(args.params), version=args.version)
        elif args.command == 'get':
            result = lib.get(args.reference, environment=args.env, parameters=json.loads(args.params))
        elif args.command == 'bind-env':
            result = lib.bind_env(args.name, args.environment, json.loads(args.params))
        else: result = lib.diff(args.left, args.right)
        print(json.dumps({'ok': True, 'code': 'OK', 'data': result}, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError) as exc:
        print(json.dumps({'ok': False, 'code': getattr(exc, 'code', 'RECIPE_INVALID_ARGS'),
                          'message': str(exc) if isinstance(exc, LibraryError) else 'Invalid file or JSON input'}, ensure_ascii=False))
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
