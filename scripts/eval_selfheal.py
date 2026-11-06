#!/usr/bin/env python3
"""Self-heal integration ladder -> eval/out/selfheal.json."""
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'eval/out'
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    env=os.environ.copy();env['PYTHONPATH']=str(ROOT)
    p=subprocess.run([str(ROOT/'.venv/bin/python'),'-m','pytest','tests/test_selfheal.py','-v','--tb=short'],
                     cwd=ROOT,env=env,text=True,capture_output=True,timeout=240)
    log=(p.stdout or '')+'\n'+(p.stderr or '')
    (OUT/f'selfheal-{stamp}.txt').write_text(log)
    data={'stamp':stamp,'timezone':'Asia/Shanghai','status':'green' if p.returncode==0 else 'red',
          'exit_code':p.returncode,'tests':[l.strip() for l in log.splitlines() if '::test_' in l]}
    (OUT/'selfheal.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print(json.dumps(data,ensure_ascii=False,indent=2));print(f'REPORT={OUT/"selfheal.json"}')
    return p.returncode
if __name__=='__main__':sys.exit(main())
