#!/usr/bin/env python3
"""Build index.html from tools/index.template.html: embeds the lineage, video and curve data as JSON, renders the
four BALROG grid players and checks every local reference."""
import json, re
from pathlib import Path
S = Path(__file__).resolve().parent  # tools/
SITE = S.parent  # repository root
tpl = (S / "index.template.html").read_text()
lin = json.load(open(SITE / "static/data/lineages.json")); vid = json.load(open(SITE / "static/data/videos.json"))
cur = json.load(open(SITE / "static/data/curves.json")); ana = json.load(open(SITE / "static/data/anatomy.json")); cases = json.load(open(SITE / "static/data/cases.json"))
traj = json.load(open(SITE / "static/data/trajectory.json"))
def js(o): return json.dumps(o, separators=(",", ":")).replace("</", "<\\/")

# the teaser as inline SVG so the page's theme can recolour its ink and outlines (fills/strokes stay as attributes)
svg = (SITE / "static/img/fig1_teaser_method.svg").read_text()
vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
svg = re.sub(r'<svg[^>]*>', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + vb + '" class="teaser-svg" role="img" '
             'aria-label="Figure 1. (a) Naive search in harness space, guided by a meta-agent: candidates drift along a few local lineages inside one undivided region. '
             '(b) Harness-MAP: the structure-token space is partitioned into cells; at step t+1 a high-variance cell is sub-split and children are bred from cell elites. '
             'Legend: candidate shapes, a fitness colour scale from low to high, and markers for parent, child and other candidates.">', svg, count=1)
html = (tpl.replace("__TEASER_SVG__", svg).replace("__LINEAGES_JSON__", js(lin)).replace("__VIDEOS_JSON__", js(vid)).replace("__CURVES_JSON__", js(cur)).replace("__ANATOMY_JSON__", js(ana)).replace("__CASES_JSON__", js(cases)).replace("__TRAJ_JSON__", js(traj)))
# cache-busting: GitHub Pages serves assets with max-age=600 and browsers reuse cached CSS/JS on a normal navigation, so
# every build stamps the stylesheet and script references with a content hash
import hashlib
def ver(rel): return hashlib.sha1((SITE / rel).read_bytes()).hexdigest()[:8]
html = html.replace('href="static/css/style.css"', f'href="static/css/style.css?v={ver("static/css/style.css")}"').replace('src="static/js/main.js"', f'src="static/js/main.js?v={ver("static/js/main.js")}"')
assert html.count("style.css?v=") == 1 and html.count("main.js?v=") == 1
(SITE / "index.html").write_text(html)
# link check: every local reference must exist
missing = []
for ref in set(re.findall(r'(?:src|href|poster)="(static/[^"]+)"', html)):
    if not (SITE / ref.split('?')[0]).exists(): missing.append(ref)
for section in [vid["balrog"]["mazewalk"], vid["nav"]] + [t["entries"] for t in vid["balrog"]["tasks"]] + list(vid["games"].values()):
    for e in section:
        for k in ("file", "poster"):
            if e.get(k) and not (SITE / e[k]).exists(): missing.append(e[k])
left = re.findall(r"__[A-Z_]+__", html)
print("index.html bytes:", len(html), "| missing local refs:", missing or "none", "| unreplaced placeholders:", left or "none")
