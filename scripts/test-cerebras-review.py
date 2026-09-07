#!/usr/bin/env python3
import importlib.util, tempfile, unittest, urllib.error
from pathlib import Path
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('review', Path(__file__).with_name('cerebras-review.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

class ReviewSafety(unittest.TestCase):
    def test_cap_includes_failed_reservations(self):
        ledger = {'operatingCapUsd': 4.5, 'ceilingUsd': 5, 'requests': [{'reservedUsd': 4.49, 'status': 'failed'}]}
        with self.assertRaises(ValueError): r.reserve(ledger, .02)
        self.assertAlmostEqual(r.reserve(ledger, .005), 4.495)
    def test_invalid_financial_values(self):
        for value in [float('nan'), float('inf'), -1, True, '0.1']:
            with self.assertRaises(ValueError): r.number(value)
    def test_cap_cannot_be_raised_in_ledger(self):
        with self.assertRaises(ValueError): r.reserve({'operatingCapUsd': 999, 'ceilingUsd': 999, 'requests': []}, 4.6)
    def test_output_schema(self):
        good = {'summary': 'Source review', 'verdict': 'REVISE', 'items': [{'issue': 'A', 'evidence': 'B', 'change': 'C', 'check': 'D'}]}
        self.assertEqual(r.validate(good), good)
        self.assertEqual(r.validate(dict(good, verdict='ACCEPT', items=[]))['items'], [])
        for bad in [{}, dict(good, verdict='SHIP'), dict(good, execute='command'), dict(good, summary='x'*1501)]:
            with self.assertRaises(ValueError): r.validate(bad)
    def test_redirect_refused(self):
        with self.assertRaises(ValueError): r.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test')
    def test_credential_destination_restricted(self):
        with self.assertRaises(ValueError): r.fetch(r.MODELS_URL, key='test')
        with self.assertRaises(ValueError): r.fetch('https://other.test', key='test')
    def test_packet_limits_and_optional_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            for name in r.ALLOWLIST:
                path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text('x' * 16000)
            css = root / 'src/index.css'; css.write_text('first' + 'z' * 16000)
            evidence = root / 'demo/exhibition/checks.json'; evidence.parent.mkdir(parents=True); evidence.write_text('y' * 16000)
            with patch.object(r, 'ROOT', root): data = r.packet()
            self.assertEqual(len(data['sources']), len(r.ALLOWLIST) + 2)
            for item in data['sources']:
                self.assertLessEqual(len(item['text']), 15000)
                self.assertEqual(len(item['sha256']), 64)
            self.assertEqual(data['sources'][-2]['text'], 'z' * 15000)
            evidence.unlink()
            with patch.object(r, 'ROOT', root): self.assertEqual(len(r.packet()['sources']), len(r.ALLOWLIST) + 1)
    def test_error_retains_reservation_and_stops(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); folder = root / 'docs/art'; folder.mkdir(parents=True)
            ledger = folder / 'spend.json'; r.save(ledger, {'operatingCapUsd': 4.5, 'ceilingUsd': 5, 'requests': []})
            key = root / '.config/helives/cerebras.key'; key.parent.mkdir(parents=True); key.write_text('test-only')
            calls = []
            def fake(url, *args):
                calls.append(url)
                if url == r.MODELS_URL: return {'data': [{'id': r.MODEL, 'pricing': {'prompt': '0.00000099', 'completion': '0.00000149'}}]}
                raise TimeoutError()
            with patch.object(r, 'ROOT', root), patch.object(r, 'packet', return_value={}), patch.object(r, 'fetch', side_effect=fake), patch.object(Path, 'home', return_value=root):
                with self.assertRaises(SystemExit): r.run()
            saved = r.json.loads(ledger.read_text())['requests']
            self.assertEqual(len(saved), 1); self.assertEqual(saved[0]['status'], 'failed'); self.assertGreater(saved[0]['reservedUsd'], 0)
            self.assertEqual(calls, [r.MODELS_URL, r.CHAT_URL])

if __name__ == '__main__': unittest.main()
