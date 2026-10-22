import json
import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from xml.etree import ElementTree

from update_github_stars import CACHE, badge_path, format_count, refresh, render_badge, validate_count


class StarTests(unittest.TestCase):
    def test_rejects_invalid_responses(self):
        for value in [None, 'invalid', -1, True, 1.5]:
            with self.assertRaises(ValueError):
                validate_count({'stargazers_count': value})
        self.assertEqual(validate_count({'stargazers_count': 0}), 0)

    def test_svg_and_format(self):
        self.assertEqual(format_count(521), '521')
        self.assertEqual(format_count(1630), '1.6k')
        for count in [0, 67, 521, 1630, 12000]:
            svg = ElementTree.fromstring(render_badge('owner/repo', count))
            self.assertEqual(svg.attrib['height'], '20')
            self.assertNotIn('invalid', render_badge('owner/repo', count))

    def test_partial_failure_keeps_last_success_and_retries(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text('<a class="star-badge" href="https://github.com/a/good"></a><a class="star-badge" href="https://github.com/a/fail"></a>')
            (root / CACHE).parent.mkdir()
            old = {'stars': 99, 'updated_at': 'old-time'}
            (root / CACHE).write_text(json.dumps({'repositories': {'a/fail': old}}))
            previous = root / badge_path('a/fail')
            previous.parent.mkdir(parents=True)
            previous.write_text(render_badge('a/fail', 99))
            old_bytes = previous.read_bytes()
            calls = []
            def fetch(repo):
                calls.append(repo)
                if repo == 'a/fail':
                    raise RuntimeError('limited')
                return 123
            with redirect_stdout(io.StringIO()):
                failed = refresh(root, fetch=fetch, sleep=lambda _: None)
            self.assertEqual(failed, ['a/fail'])
            self.assertEqual(calls.count('a/fail'), 3)
            self.assertEqual(previous.read_bytes(), old_bytes)
            data = json.loads((root / CACHE).read_text())['repositories']
            self.assertEqual(data['a/fail'], old)
            self.assertEqual(data['a/good']['stars'], 123)

    def test_homepage_uses_existing_same_origin_badges(self):
        root = Path(__file__).resolve().parents[1]
        page = (root / 'index.html').read_text()
        self.assertNotIn('img.shields.io/github/stars', page)
        from update_github_stars import BadgeLinks
        parser = BadgeLinks()
        parser.feed(page)
        self.assertEqual(len(parser.repos), 8)
        for repo in parser.repos:
            path = badge_path(repo)
            self.assertIn(str(path), page)
            ElementTree.parse(root / path)


if __name__ == '__main__':
    unittest.main()
