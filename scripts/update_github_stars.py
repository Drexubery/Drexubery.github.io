#!/usr/bin/env python3
"""Refresh same-origin badges, keeping the last successful result per repository."""
import argparse
import html
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('data/github-stars.json')
BADGES = Path('images/github-stars')
GITHUB_MARK = 'M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'


class BadgeLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.repos = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag != 'a' or 'star-badge' not in attrs.get('class', '').split():
            return
        match = re.fullmatch(r'https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/?', attrs.get('href', ''))
        if not match:
            raise ValueError('Invalid repository link on a star badge')
        if match[1] not in self.repos:
            self.repos.append(match[1])


def badge_path(repo):
    return BADGES / (repo.lower().replace('/', '--') + '.svg')


def validate_count(payload):
    count = payload.get('stargazers_count')
    if type(count) is not int or count < 0:
        raise ValueError('GitHub response did not contain a valid star count')
    return count


def fetch_count(repo):
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if token:
        request = Request('https://api.github.com/repos/' + repo, headers={
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'homepage-star-cache',
        })
        with urlopen(request, timeout=25) as response:
            payload = json.load(response)
    else:
        # Local runs use the existing GitHub CLI login, never a token in the website.
        result = subprocess.run(['gh', 'api', 'repos/' + repo], capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise RuntimeError('GitHub API request failed')
        payload = json.loads(result.stdout)
    return validate_count(payload)


def format_count(count):
    if count < 1000:
        return str(count)
    value = f'{count / 1000:.1f}'.removesuffix('.0')
    return value + 'k'


def render_badge(repo, count):
    label = format_count(count)
    bubble = max(27, len(label) * 7 + 12)
    width = 32 + bubble
    center = 31.5 + bubble / 2
    title = html.escape(f'{repo}: {count:,} GitHub stars')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="20" role="img" aria-label="{title}">
<title>{title}</title>
<defs><linearGradient id="bg" x2="0" y2="100%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e6e6e6"/></linearGradient></defs>
<rect x=".5" y=".5" width="25" height="19" rx="2" fill="url(#bg)" stroke="#d5d5d5"/>
<g transform="translate(5 3) scale(.583333)" fill="#181717"><path d="{GITHUB_MARK}"/></g>
<path d="M33.5 .5h{bubble-4}q2 0 2 2v15q0 2-2 2h-{bubble-4}q-2 0-2-2v-4l-3-3 3-3v-4q0-2 2-2z" fill="#fafafa" stroke="#d5d5d5"/>
<text x="{center}" y="14" text-anchor="middle" fill="#333" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="700" font-size="11">{label}</text>
</svg>
'''


def write_if_changed(path, content):
    if path.exists() and path.read_text() == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.tmp')
    temp.write_text(content)
    temp.replace(path)


def refresh(root=ROOT, fetch=fetch_count, attempts=3, sleep=time.sleep):
    parser = BadgeLinks()
    parser.feed((root / 'index.html').read_text())
    if not parser.repos:
        raise ValueError('No homepage star badges found')
    cache_path = root / CACHE
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {'repositories': {}}
    records = cache['repositories']
    failures = []
    for repo in parser.repos:
        count = None
        for attempt in range(attempts):
            try:
                count = fetch(repo)
                validate_count({'stargazers_count': count})
                break
            except Exception:
                count = None
                if attempt + 1 < attempts:
                    sleep(2 ** attempt)
        if count is None:
            failures.append(repo)
            print(f'::warning::Could not refresh {repo}; keeping the last successful badge.')
            continue
        records[repo] = {'stars': count, 'updated_at': datetime.now(timezone.utc).isoformat(timespec='seconds')}
        write_if_changed(root / badge_path(repo), render_badge(repo, count))
        print(f'{repo}: {count}')
    write_if_changed(cache_path, json.dumps(cache, ensure_ascii=False, indent=2) + '\n')
    return failures


if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--root', type=Path, default=ROOT)
    failures = refresh(args.parse_args().root)
    # The workflow publishes successful updates before surfacing partial failures.
    raise SystemExit(1 if failures else 0)
