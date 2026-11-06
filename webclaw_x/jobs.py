"""Live jobs: per-home persistence, process-group cancellation and exclusion.

Persist lifecycle metadata only, never stdin, recipe bodies or parameters.
Lock order is always _guard then flock; flock protects lifecycle transactions.
"""
from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
import queue
import re
import signal
import subprocess
import threading
import time
import uuid
from pathlib import Path

_jobs: dict[str, 'LiveRun'] = {}
_guard = threading.RLock()
_ACTIVE = {'running', 'need_human', 'cancelling'}


def _home(home=None):
    return Path(home or os.environ.get('WEBCLAW_HOME', Path.home() / '.webclaw')).resolve()


@contextmanager
def _disk_guard(home):
    directory = home / 'jobs'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Never unlink the inode on which other gateways may already be waiting.
    with (directory / '.lock').open('a', encoding='utf-8') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            yield directory
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def _process_info(pid):
    try:
        fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
        return fields[0], int(fields[2]), fields[19]
    except (OSError, ValueError, IndexError):
        return None


def _pid_alive(pid):
    info = _process_info(pid)
    if info is not None:
        return info[0] not in ('Z', 'X')
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _alive(row):
    pid = row['pid']
    info = _process_info(pid)
    if info and row.get('process_start') and info[2] != row['process_start']:
        return False  # recycled PID, not our registered child
    if _pid_alive(pid):
        return True
    pgid = row.get('pgid')
    if not pgid:
        return False
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    if Path('/proc').is_dir():
        # A dead group leader may leave live descendants; zombies alone are dead.
        return any((p := _process_info(int(path.parent.name))) is not None
                   and p[1] == pgid and p[0] not in ('Z', 'X')
                   for path in Path('/proc').glob('[0-9]*/stat'))
    return True


def _write_record(path, row):
    temporary = path.with_suffix('.tmp')
    try:
        with temporary.open('w', encoding='utf-8') as stream:
            os.chmod(temporary, 0o600)
            json.dump(row, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _records(home):
    """Under flock: clean stale records, fail closed on corrupt metadata."""
    rows = []
    for path in sorted((home / 'jobs').glob('*.json')):
        row = json.loads(path.read_text(encoding='utf-8'))
        if (not isinstance(row, dict) or row.get('id') != path.stem
                or not re.fullmatch(r'[A-Za-z0-9_-]+', path.stem)
                or type(row.get('pid')) is not int or row['pid'] <= 1
                or row['pid'] == os.getpid()
                or row.get('home') != str(home)
                or not isinstance(row.get('status'), str)
                or (row.get('owner_pid') is not None and
                    (type(row['owner_pid']) is not int or row['owner_pid'] <= 1))
                or row.get('pgid') not in (None, row['pid'])
                or row.get('cancel_marker') != str(home / 'jobs' / f'{path.stem}.cancel')):
            raise ValueError('Invalid job metadata; inspect WEBCLAW_HOME/jobs')
        info = _process_info(row['pid'])
        if (info and row.get('pgid') and info[1] != row['pgid']
                and (not row.get('process_start') or info[2] == row['process_start'])):
            raise ValueError('Invalid job process group')
        if row.get('status') not in _ACTIVE or not _alive(row):
            path.unlink(missing_ok=True)
            if not _pid_alive(row.get('owner_pid') or row['pid']):
                Path(row['cancel_marker']).unlink(missing_ok=True)
            continue
        rows.append(row)
    return rows


def _marker(row):
    errors = []
    for marker in (Path(row['cancel_marker']), Path(row['home']) / 'control' / 'cancel'):
        try:
            marker.parent.mkdir(parents=True, exist_ok=True)
            marker.write_text('1', encoding='utf-8')
        except OSError as exc:
            errors.append(str(exc))
    return '; '.join(errors) or None


def _terminate(row, proc=None):
    def send(sig):
        try:
            if row.get('pgid'):
                os.killpg(row['pgid'], sig)
            else:
                os.kill(row['pid'], sig)
        except ProcessLookupError:
            pass
    for sig, seconds in ((signal.SIGTERM, 0.5), (signal.SIGKILL, 2.0)):
        if not _alive(row):
            break
        send(sig)
        deadline = time.monotonic() + seconds
        while _alive(row) and time.monotonic() < deadline:
            if proc is not None:
                proc.poll()
            time.sleep(0.01)
    if proc is not None:
        proc.poll()
    return not _alive(row)


class LiveRun:
    def __init__(self, command, env, stdin_text, timeout, dualwrite):
        self.id = uuid.uuid4().hex
        self.home = _home(env['WEBCLAW_HOME'])
        self.path = self.home / 'jobs' / f'{self.id}.json'
        self.cancel_marker = self.path.with_suffix('.cancel')
        self.deadline = time.monotonic() + timeout
        self.dualwrite = dualwrite
        self.events = queue.Queue()
        self.stdout = ''
        self.stderr = ''
        self.waiting = None
        self.run_dir = None
        self.collect_lock = threading.Lock()
        self.cancelled = threading.Event()
        self.timed_out = threading.Event()
        self.proc = subprocess.Popen(command, env=env, text=True, stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=1,
                                     start_new_session=True)
        info = _process_info(self.proc.pid)
        self.metadata = {
            'id': self.id, 'pid': self.proc.pid, 'pgid': self.proc.pid,
            'owner_pid': os.getpid(), 'process_start': info[2] if info else None,
            'started_at': datetime.now(timezone.utc).isoformat(),
            'recipe': 'stdin' if stdin_text is not None or '--stdin' in command else 'command',
            'status': 'running', 'home': str(self.home),
            'cancel_marker': str(self.cancel_marker),
        }

    def launch(self, stdin_text):
        self.readers = [threading.Thread(target=self._stdout, daemon=True),
                        threading.Thread(target=self._stderr, daemon=True)]
        for reader in self.readers:
            reader.start()
        threading.Thread(target=self._watchdog, daemon=True).start()
        try:
            if stdin_text is not None:
                self.proc.stdin.write(stdin_text)
        except BrokenPipeError:
            pass  # report early exit/cancellation through collect()
        finally:
            try:
                self.proc.stdin.close()
            except BrokenPipeError:
                pass

    def _stdout(self):
        try:
            for line in self.proc.stdout:
                self.stdout = (self.stdout + line)[-200_000:]
                m = re.search(r'run_dir=(\S+)', line)
                if m:
                    self.run_dir = m.group(1)
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if isinstance(row, dict) and row.get('type') in ('need_human', 'done'):
                    self.events.put(row)
        finally:
            self.events.put({'type': '_eof'})

    def _stderr(self):
        for line in self.proc.stderr:
            self.stderr = (self.stderr + line)[-50_000:]

    def _finish_locked(self):
        # Also used by watchdog for abandoned NEED_HUMAN jobs (no collector).
        if self.cancel_marker.exists():
            self.cancelled.set()
        if self.path.exists():
            row = json.loads(self.path.read_text(encoding='utf-8'))
            if row.get('status') == 'cancelling':
                self.cancelled.set()
        self.path.unlink(missing_ok=True)
        self.cancel_marker.unlink(missing_ok=True)
        _jobs.pop(self.id, None)

    def _watchdog(self):
        try:
            self.proc.wait(timeout=max(0.01, self.deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            self.timed_out.set()
            _terminate(self.metadata, self.proc)
            self.proc.wait()
        finally:
            with _guard, _disk_guard(self.home):
                self._finish_locked()
            self.events.put({'type': '_exit'})

    def collect(self):
        with self.collect_lock:
            while True:
                try:
                    event = ({'type': '_cancelled'} if self.cancelled.is_set() else
                             self.events.get(timeout=max(0.01, self.deadline - time.monotonic())))
                except queue.Empty:
                    self.timed_out.set()
                    _terminate(self.metadata, self.proc)
                    event = {'type': '_timeout'}
                kind = event['type']
                if kind == 'need_human':
                    with _guard, _disk_guard(self.home):
                        if self.cancel_marker.exists():
                            self.cancelled.set()
                        if not self.cancelled.is_set() and self.proc.poll() is None:
                            self.waiting = event
                            self.metadata['status'] = 'need_human'
                            _write_record(self.path, self.metadata)
                            return self.result(False, 'NEED_HUMAN', 'Human action required; reply to this run_id')
                self.proc.wait()  # bounded by watchdog, without lifecycle locks
                for reader in self.readers:
                    reader.join(timeout=1)
                self.waiting = None
                with _guard, _disk_guard(self.home):
                    self._finish_locked()
                    if kind == '_cancelled' or self.cancelled.is_set():
                        return self.result(False, 'RUN_CANCELLED', 'Run cancelled; child process stopped')
                timed_out = self.timed_out.is_set() or kind == '_timeout'
                ok = self.proc.returncode == 0 and not timed_out
                return self.result(ok, 'TIMEOUT' if timed_out else ('OK' if ok else 'RUN_FAILED'))

    def result(self, ok, code, message=''):
        return {'ok': ok, 'code': code, 'message': message,
                'job_id': self.id, 'run_dir': self.run_dir, 'waiting': self.waiting,
                'data': {'stdout': self.stdout, 'stderr': self.stderr, 'exit_code': self.proc.poll()}}


def start(command, env, stdin_text, timeout, dualwrite=True):
    home = _home(env['WEBCLAW_HOME'])
    job = None
    try:
        with _guard, _disk_guard(home):
            if _records(home):
                return {'ok': False, 'code': 'RUN_BUSY',
                        'message': 'A run is active in WEBCLAW_HOME; reply or cancel first', 'data': {}}
            try:
                (home / 'control' / 'cancel').unlink(missing_ok=True)
            except NotADirectoryError:
                pass  # marker cannot exist if control is a file; direct cancel still works
            job = LiveRun(command, env, stdin_text, timeout, dualwrite)
            try:
                _write_record(job.path, job.metadata)
                _jobs[job.id] = job
            except OSError:
                # Do not release exclusion while an unregistered child is alive.
                _terminate(job.metadata, job.proc)
                job.proc.wait()
                job.path.unlink(missing_ok=True)
                job = None
                raise
    except (OSError, ValueError):
        if job is not None:
            _terminate(job.metadata, job.proc)
            job.proc.wait()
            job.path.unlink(missing_ok=True)
        return {'ok': False, 'code': 'INTERNAL',
                'message': 'Cannot register job; inspect WEBCLAW_HOME/jobs and permissions', 'data': {}}
    job.launch(stdin_text)
    return job.collect()


def waiting(run_id='', prompt_id='', *, claim=False):
    with _guard:
        candidates = [j for j in _jobs.values()
                      if j.waiting and j.proc.poll() is None and (not run_id or j.id == run_id)]
        if len(candidates) != 1:
            return None
        job = candidates[0]
        if prompt_id and prompt_id != job.waiting.get('prompt_id'):
            return None
        if not job.run_dir:
            return None
        rd = Path(job.run_dir).resolve()
        if not rd.is_relative_to(job.home / 'runs'):
            return None
        if not (rd / 'human' / 'waiting_human.json').is_file():
            return None
        if claim:
            job.waiting = None
        return job


def active_job_ids() -> list[str]:
    """In-process snapshot; start/cancel additionally inspect disk."""
    with _guard:
        return [j.id for j in _jobs.values() if j.proc.poll() is None]


def has_active() -> bool:
    return bool(active_job_ids())


def cancel_active(run_id: str | None = None, *, home=None) -> dict:
    """Cancel in another session sharing home; hold exclusion until stopped."""
    with _guard:
        local = next((j for j in _jobs.values() if (not run_id or j.id == run_id)
                      and (home is None or j.home == _home(home))
                      and j.proc.poll() is None), None)
        target_home = local.home if local else _home(home)
        try:
            with _disk_guard(target_home):
                rows = _records(target_home)
                row = next((r for r in rows if not run_id or r['id'] == run_id), None)
                if row is None:
                    return {'ok': True, 'code': 'NO_ACTIVE_RUN',
                            'message': 'No matching gateway-managed run is active',
                            'job_id': None, 'data': {'cancelled': False}}
                job = _jobs.get(row['id'])
                if job:
                    job.cancelled.set()
                    job.waiting = None
                row['status'] = 'cancelling'
                _write_record(target_home / 'jobs' / f"{row['id']}.json", row)
                marker_error = _marker(row)
                stopped = _terminate(row, job.proc if job else None)
                if job:
                    job.events.put({'type': '_cancelled'})
                if not stopped:
                    return {'ok': False, 'code': 'RUN_FAILED', 'job_id': row['id'],
                            'message': 'Cancellation requested but process is still alive',
                            'data': {'cancelled': False}}
                (target_home / 'jobs' / f"{row['id']}.json").unlink(missing_ok=True)
                if job:
                    job._finish_locked()
                elif not _pid_alive(row.get('owner_pid') or row['pid']):
                    Path(row['cancel_marker']).unlink(missing_ok=True)
                result = (job.result(True, 'RUN_CANCELLED', 'Run cancelled; child process stopped')
                          if job else {'ok': True, 'code': 'RUN_CANCELLED',
                                       'message': 'Run cancelled across sessions; process stopped',
                                       'job_id': row['id'], 'data': {}})
                result['data']['cancelled'] = True
                if marker_error:
                    result['data']['cancel_marker_error'] = marker_error
                return result
        except (OSError, ValueError):
            return {'ok': False, 'code': 'INTERNAL',
                    'message': 'Cannot cancel job; inspect WEBCLAW_HOME/jobs and permissions',
                    'data': {'cancelled': False}}
