#!/usr/bin/env python3
"""Builds the documentation site in ../docs from content/*.md.

Needs Python 3 and the `markdown` package (pip install markdown). Run: python3 docs-src/build.py
Screenshots live in docs/img (NAME-dark.webp / NAME-light.webp) and the live demo in docs/demo; this script
leaves both alone and only rewrites the pages, style.css and site.js.

In content files: a small header (title, lead), then Markdown. [[shots: name | caption ; name | caption]]
puts screenshots in a row.
"""
import html, json, os, re, shutil
import markdown
from markdown.extensions.toc import slugify

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'docs')
VER = json.load(open(os.path.join(ROOT, 'manifest.json')))['version']
REPO = 'https://github.com/varnica95/restless'

PAGES = ['getting-started', 'requests', 'request-screen', 'mocks', 'api-docs', 'environments', 'variables', 'buttons', 'testing-tools', 'settings', 'how-it-works']


def read(name):
    text = open(os.path.join(HERE, 'content', f'{name}.md')).read()
    meta = {}
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if m:
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':')
            meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text


def shots(spec):
    items = [x.split('|', 1) for x in spec.split(';')]
    figs = ''.join(
        f'<figure class="shot"><img class="th-d" src="img/{n.strip()}-dark.webp" alt="{html.escape(c.strip())}" loading="lazy">'
        f'<img class="th-l" src="img/{n.strip()}-light.webp" alt="{html.escape(c.strip())}" loading="lazy"><figcaption>{html.escape(c.strip())}</figcaption></figure>'
        for n, c in items)
    return f'\n\n<div class="shots n{len(items)}">{figs}</div>\n\n'


def md(text):
    text = re.sub(r'\[\[shots:(.*?)\]\]', lambda m: shots(m.group(1)), text)
    return markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists', 'toc'])


TITLES = {p: read(p)[0]['title'] for p in PAGES}
NAV = [('index', 'Overview')] + [(p, TITLES[p]) for p in PAGES] + [('demo/index', 'Live demo')]


def layout(pid, title, body, toc='', desc=''):
    items = ''.join(f'<li><a href="{p}.html"{" class=on aria-current=page" if p == pid else ""}>{html.escape(t)}</a></li>' for p, t in NAV)
    ids = [p for p, _ in NAV]
    i = ids.index(pid)
    pn = ''
    if pid != 'index':
        prev, nxt = NAV[i - 1], NAV[i + 1] if i + 1 < len(NAV) else None
        pn = ('<nav class="pn" aria-label="Previous and next">'
              + f'<a class="prev" href="{prev[0]}.html"><span>Previous</span>{html.escape(prev[1])}</a>'
              + (f'<a class="next" href="{nxt[0]}.html"><span>Next</span>{html.escape(nxt[1])}</a>' if nxt else '') + '</nav>')
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} · RESTless</title><meta name="description" content="{html.escape(desc)}">
<link rel="icon" href="img/favicon.png"><link rel="stylesheet" href="style.css">
<script>try{{const t=localStorage.getItem('rl-theme');if(t)document.documentElement.classList.add(t)}}catch(e){{}}</script>
</head><body>
<header class="top"><button class="tbtn menu" id="mbtn" aria-expanded="false" aria-controls="side" aria-label="Pages">☰</button>
<a class="brand" href="index.html"><img src="img/logo.png" alt=""><b>RESTless</b></a><span class="ver">v{VER}</span><span class="sp"></span>
<a class="tlink" href="demo/index.html">Live demo</a><a class="tlink" href="{REPO}">GitHub</a>
<button class="tbtn" id="theme" aria-label="Switch between light and dark" title="Light / dark"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/></svg></button></header>
<div class="wrap{' home' if pid == 'index' else ''}"><nav class="side" id="side" aria-label="Pages"><ul>{items}</ul></nav>
<main id="main">{body}{pn}<footer>RESTless v{VER} · <a href="{REPO}">GitHub</a></footer></main>
{f'<aside class="toc" aria-label="On this page"><b>On this page</b>{toc}</aside>' if toc else ''}</div>
<script src="site.js"></script></body></html>'''


def build():
    for f in ('style.css', 'site.js'):
        shutil.copy(os.path.join(HERE, f), os.path.join(OUT, f))
    open(os.path.join(OUT, '.nojekyll'), 'w').close()
    for p in PAGES:
        meta, text = read(p)
        heads = re.findall(r'^## (.+)$', text, re.M)
        toc = '<ul>' + ''.join(f'<li><a href="#{slugify(t, "-")}">{html.escape(t)}</a></li>' for t in heads) + '</ul>' if len(heads) > 2 else ''
        body = f'<h1>{html.escape(meta["title"])}</h1><p class="lead">{html.escape(meta["lead"])}</p>' + md(text)
        open(os.path.join(OUT, f'{p}.html'), 'w').write(layout(p, meta['title'], body, toc, meta['lead']))
    cards = [('request-screen', 'request', 'Inspect & replay', 'Edit any call and run it again.'),
             ('request-screen', 'simulate', 'Simulate', 'Give the app a different answer.'),
             ('mocks', 'mock-editor', 'Mock endpoints', 'Answer endpoints that don’t exist yet.'),
             ('api-docs', 'docs', 'API docs', 'Browse and try your OpenAPI docs.'),
             ('environments', 'where-as', 'Environments & users', 'Send requests anywhere, as anyone.'),
             ('testing-tools', 'edge-cases', 'Testing tools', 'Offline, permissions, edge cases.'),
             ('requests', 'requests', 'Requests', 'Search, filter and pin calls.'),
             ('settings', 'export', 'Import & export', 'Share your setup as one file.')]
    cardhtml = ''.join(
        f'<a class="card" href="{p}.html"><span class="thumb"><img class="th-d" src="img/{s}-dark.webp" alt="" loading="lazy"><img class="th-l" src="img/{s}-light.webp" alt="" loading="lazy"></span>'
        f'<b>{html.escape(t)}</b><span>{html.escape(d)}</span></a>' for p, s, t, d in cards)
    home = f'''<section class="hero"><img class="mascot" src="img/logo.png" alt="RESTless mockingbird"><h1>RESTless</h1>
<p class="tag">The Network tab on steroids. Never let your API rest.</p>
<p class="sub">A Chrome extension that shows every API call your app makes, and lets you change, replay and fake them.</p>
<div class="cta"><a class="btn primary" href="getting-started.html">Get started</a><a class="btn" href="demo/index.html">Try the live demo</a></div></section>
<figure class="heroshot"><img class="th-d" src="img/hero-dark.webp" alt="RESTless next to a web app, showing a request and its response"><img class="th-l" src="img/hero-light.webp" alt="RESTless next to a web app, showing a request and its response"></figure>
<h2 id="features">What it does</h2><div class="cards">{cardhtml}</div>
<h2 id="install">Install in a minute</h2>
<ol><li>Clone the repo or download it as a ZIP from <a href="{REPO}">GitHub</a>.</li><li>Open <code>chrome://extensions</code> and turn on <b>Developer mode</b>.</li><li>Click <b>Load unpacked</b> and pick the <code>restless</code> folder.</li></ol>
<p>Then press <kbd>Ctrl</kbd>+<kbd>Y</kbd> on your app. <a href="getting-started.html">Getting started →</a></p>
<h2 id="demo">Try it first</h2><p>The <a href="demo/index.html">live demo</a> runs RESTless inside a small sample app, right in your browser.</p>'''
    open(os.path.join(OUT, 'index.html'), 'w').write(layout('index', 'RESTless', home, '', 'RESTless: a Chrome extension that shows every API call your app makes, and lets you change, replay and fake them.'))
    print(f'Built {len(PAGES) + 1} pages in docs/ (v{VER})')


if __name__ == '__main__':
    build()
