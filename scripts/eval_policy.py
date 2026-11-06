#!/usr/bin/env python3
"""P1 host policy + live HITL tests -> eval/out/policy.json. No model needed."""
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'eval' / 'out'

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    env = os.environ.copy()
    env['PYTHONPATH'] = str(ROOT)
    env.setdefault('WEBCLAW_HEADLESS', '1')
    p = subprocess.run([str(ROOT/'.venv/bin/python'), '-m', 'pytest',
                        'tests/test_policy_hitl.py', '-v', '--tb=short'],
                       cwd=ROOT, env=env, text=True, capture_output=True, timeout=300)
    log = (p.stdout or '') + '\n' + (p.stderr or '')
    (OUT/f'policy-{stamp}.txt').write_text(log)
    results = [line.strip() for line in log.splitlines() if '::test_' in line]
    report = {'stamp': stamp, 'timezone': 'Asia/Shanghai',
              'status': 'green' if p.returncode == 0 else 'red',
              'exit_code': p.returncode, 'tests': results,
              'note': 'HITL uses real runtime file bridge and synthetic reply; not a real captcha service'}
    (OUT/'policy.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'REPORT={OUT/"policy.json"}')
    return p.returncode

if __name__ == '__main__':
    sys.exit(main())
