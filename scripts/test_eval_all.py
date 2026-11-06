"""Fast stdlib checks; no browser, no changes to L1 suite membership."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock
import eval_all as dashboard


class DashboardTests(unittest.TestCase):
    def test_numeric_report(self):
        self.assertEqual(dashboard.normalized({'status':'green','passed':3,'failed':0},0)['status'],'green')

    def test_verbose_rows_ignore_failure_summary_duplicate(self):
        r=dashboard.counts({'tests':['tests/x.py::test_a PASSED [ 50%]',
                                   'tests/x.py::test_b FAILED [100%]',
                                   'FAILED tests/x.py::test_b - AssertionError']})
        self.assertEqual((r['passed'],r['failed']),(1,1))

    def test_nonzero_exit_never_green(self):
        self.assertEqual(dashboard.normalized({'status':'green','passed':3,'failed':0},1)['status'],'red')

    def test_empty_and_unknown_report_not_green(self):
        for r in ({'status':'green'}, {'status':'unknown','passed':3}):
            self.assertEqual(dashboard.normalized(r,0)['status'],'red')

    def test_skip_is_yellow(self):
        self.assertEqual(dashboard.normalized({'status':'green','passed':3,'skipped':1},0)['status'],'yellow')

    def test_invalid_count_rejected(self):
        for v in (-1,True,'3'):
            with self.assertRaises(ValueError): dashboard.counts({'passed':v})

    def test_stale_report_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            out=Path(d)
            (out/'latest.json').write_text(json.dumps({'status':'green','passed':49,'failed':0}))
            proc=MagicMock();proc.wait.return_value=0
            with patch.object(dashboard,'OUT',out), patch.object(dashboard,'ROOT',out), patch.object(dashboard.subprocess,'Popen',return_value=proc):
                result=dashboard.run_suite('L1','eval_smoke.py','latest.json','python','test')
            self.assertEqual(result['status'],'red')
            self.assertFalse(result['report_fresh'])
            self.assertEqual(result['passed'],0)
            self.assertIn('stale',result['error'])

if __name__=='__main__': unittest.main()
