#!/usr/bin/env python3
"""Build index.html from tools/index.template.html: embeds the lineage, video and curve data as JSON, renders the
four BALROG grid players, draws the adaptive-resolution storyboard (inline SVG) and checks every local reference."""
import json, re
from pathlib import Path
S = Path(__file__).resolve().parent  # tools/
SITE = S.parent  # repository root
tpl = (S / "index.template.html").read_text()
lin = json.load(open(SITE / "static/data/lineages.json")); vid = json.load(open(SITE / "static/data/videos.json"))
cur = json.load(open(SITE / "static/data/curves.json")); ana = json.load(open(SITE / "static/data/anatomy.json")); cases = json.load(open(SITE / "static/data/cases.json"))
def js(o): return json.dumps(o, separators=(",", ":")).replace("</", "<\\/")

# ------------------------------------------------------------------ adaptive-resolution storyboard
RAMP = ["#3c9bc9", "#65bdba", "#b0d6a9", "#fee199", "#fdcd94", "#faa26f", "#f97f5f", "#fc757b"]   # the eight-colour set, low -> high
CENTS = [(0.22, 0.74), (0.56, 0.82), (0.84, 0.62), (0.28, 0.28), (0.63, 0.42), (0.80, 0.20)]
SPLIT = 4                                                                        # the cell with the largest fitness range
SUBC = [(0.60, 0.45), (0.67, 0.36)]                                              # its local 2-centroid CVT
PTS = [(0.18, 0.70, .40), (0.27, 0.80, .45), (0.50, 0.86, .60), (0.60, 0.76, .62), (0.86, 0.66, .20), (0.78, 0.58, .25),
       (0.24, 0.28, .15), (0.34, 0.37, .20), (0.30, 0.20, .12), (0.56, 0.47, .30), (0.68, 0.36, .85), (0.60, 0.35, .50),
       (0.69, 0.48, .40), (0.83, 0.17, .70), (0.76, 0.27, .66)]
KIDS_KEEP = [(0.64, 0.52, .44), (0.70, 0.33, .92)]                               # bred from each child cell's elite
KIDS_REV = [(0.64, 0.52, .38), (0.70, 0.33, .80)]
def clip(poly, m, nrm):
    mx, my = m; nx, ny = nrm; out = []
    f = lambda p: (p[0] - mx) * nx + (p[1] - my) * ny
    for k in range(len(poly)):
        a, b = poly[k], poly[(k + 1) % len(poly)]; fa, fb = f(a), f(b)
        if fa <= 0: out.append(a)
        if (fa <= 0) != (fb <= 0):
            t = fa / (fa - fb); out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return out
def voronoi(cents, base=((0, 0), (1, 0), (1, 1), (0, 1))):
    cells = []
    for i, (cx, cy) in enumerate(cents):
        poly = list(base)
        for j, (ox, oy) in enumerate(cents):
            if i != j: poly = clip(poly, ((cx + ox) / 2, (cy + oy) / 2), (ox - cx, oy - cy))
        cells.append(poly)
    return cells
def nearest(p, cents): return min(range(len(cents)), key=lambda i: (p[0] - cents[i][0]) ** 2 + (p[1] - cents[i][1]) ** 2)
CELLS = voronoi(CENTS)
SUB = [clip(CELLS[SPLIT], ((SUBC[0][0] + SUBC[1][0]) / 2, (SUBC[0][1] + SUBC[1][1]) / 2), (SUBC[1][0] - SUBC[0][0], SUBC[1][1] - SUBC[0][1])),
       clip(CELLS[SPLIT], ((SUBC[0][0] + SUBC[1][0]) / 2, (SUBC[0][1] + SUBC[1][1]) / 2), (SUBC[0][0] - SUBC[1][0], SUBC[0][1] - SUBC[1][1]))]
assert all(nearest(p[:2], CENTS) == SPLIT for p in KIDS_KEEP), "a bred child falls outside the split cell"
for i, p in enumerate(PTS): assert nearest(p[:2], CENTS) == [0, 0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5][i], f"point {i} is not in its intended cell"
X0, Y0, SZ = 10, 8, 240
px = lambda x: round(X0 + x * SZ, 1); py = lambda y: round(Y0 + (1 - y) * SZ, 1)
col = lambda f: RAMP[min(len(RAMP) - 1, int(f * len(RAMP)))]
def poly_svg(poly, fill, extra=""):
    stroke = f'stroke="var(--cs{fill[4:]})" stroke-width="1.6" stroke-dasharray="5 3"' if not extra else extra
    return f'<polygon points="{" ".join(f"{px(x)},{py(y)}" for x, y in poly)}" fill="var(--{fill})" {stroke} stroke-linejoin="round"/>'
def dot(p, elite=False, child=False):
    s = f'<circle cx="{px(p[0])}" cy="{py(p[1])}" r="5.5" fill="{col(p[2])}" stroke="var(--surface)" stroke-width="2"/>'
    if elite: s += f'<circle cx="{px(p[0])}" cy="{py(p[1])}" r="9" fill="none" stroke="var(--ink)" stroke-width="1.5"/>'
    if child: s += f'<circle cx="{px(p[0])}" cy="{py(p[1])}" r="11.5" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 2"/>'
    return s
def label(x, y, text, color, w, bg="surface"):
    return (f'<rect x="{px(x) - w / 2}" y="{py(y) - 9}" width="{w}" height="16" rx="4" fill="var(--{bg})" fill-opacity="0.9"/>'
            f'<text x="{px(x)}" y="{py(y) + 3.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--{color})">{text}</text>')
def elites(points, cents):
    best = {}
    for p in points:
        c = nearest(p[:2], cents)
        if c not in best or p[2] > best[c][2]: best[c] = p
    return set(best.values())
def panel(kind):
    fills = ["cell1", "cell2", "cell3", "cell4", "cell5", "cell6"]
    s = ['<svg viewBox="0 0 260 256" role="img" aria-label="Adaptive resolution storyboard panel">']
    pts = list(PTS); cents = list(CENTS); split_now = kind in ("split", "keep")
    if split_now:
        for i, c in enumerate(CELLS):
            if i != SPLIT: s.append(poly_svg(c, fills[i]))
        s.append(poly_svg(SUB[0], "cell7")); s.append(poly_svg(SUB[1], "cell8"))
        cents = [c for i, c in enumerate(CENTS) if i != SPLIT] + SUBC
        kids = KIDS_KEEP if kind == "keep" else KIDS_KEEP
        pts = PTS + kids
    else:
        for i, c in enumerate(CELLS): s.append(poly_svg(c, fills[i], 'stroke="var(--ink)" stroke-width="2.6" stroke-dasharray="6 3"' if (i == SPLIT and kind == "pick") else ""))
        if kind == "revert": pts = PTS + KIDS_REV
    el = elites(pts, cents)
    for c in cents: s.append(f'<path d="M{px(c[0]) - 3},{py(c[1]) - 3} L{px(c[0]) + 3},{py(c[1]) + 3} M{px(c[0]) - 3},{py(c[1]) + 3} L{px(c[0]) + 3},{py(c[1]) - 3}" stroke="var(--muted)" stroke-width="1.2"/>')
    for p in pts: s.append(dot(p, elite=p in el, child=(p in KIDS_KEEP or p in KIDS_REV)))
    if kind == "pick":
        s.append(label(0.40, 0.60, "range 0.85 − 0.30 = 0.55", "ink", 128))
    if kind == "split":
        s.append(label(0.40, 0.60, "local 2-centroid CVT", "ink", 112))
    if kind == "keep":
        s.append(label(0.50, 0.24, "0.92 &gt; 0.85 ✓", "ok", 78))
    if kind == "revert":
        s.append(label(0.50, 0.24, "0.80 &lt; 0.85 ↺", "warm-ink", 78))
        s.append(label(0.38, 0.61, "remembers range 0.55", "warm-ink", 108, bg="warm-soft"))
    s.append("</svg>")
    return "".join(s)
STORY = (
    f'<figure><span class="kicker">Step t</span>{panel("pick")}<figcaption><b>Pick one cell.</b> Among the occupied cells, the one whose members’ fitness spreads the most (dashed) becomes the split hypothesis; flat or saturated cells are left alone.</figcaption></figure>'
    f'<figure><span class="kicker">Step t + 1 · 0 evaluations</span>{panel("split")}<figcaption><b>Sub-split and breed.</b> A local two-centroid CVT divides the cell on cached descriptors. One child is bred from each new cell’s elite (dashed rings), the children the step would spend anyway.</figcaption></figure>'
    f'<figure class="keep"><span class="kicker">Outcome A · kept</span>{panel("keep")}<figcaption><b>Keep the split</b> when a child cell’s elite beats the pre-split elite: the finer cells now archive two distinct elites, and later steps breed from both.</figcaption></figure>'
    f'<figure class="revert alt"><span class="kicker">Outcome B · reverted</span>{panel("revert")}<figcaption><b>Revert and remember</b> otherwise: the cell is merged back and logs its fitness range, so it is not re-split until a new candidate changes that distribution.</figcaption></figure>'
    '<div class="ramp" style="grid-column:1/-1"><span>fitness</span><span>low</span><i></i><span>high</span></div>')

# the teaser as inline SVG so the page's theme can recolour its ink and outlines (fills/strokes stay as attributes)
svg = (SITE / "static/img/fig1_teaser_method.svg").read_text()
vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
svg = re.sub(r'<svg[^>]*>', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + vb + '" class="teaser-svg" role="img" '
             'aria-label="Figure 1. (a) Naive search in harness space, guided by a meta-agent: candidates drift along a few local lineages inside one undivided region. '
             '(b) Harness-MAP: the structure-token space is partitioned into cells; at step t+1 a high-variance cell is sub-split and children are bred from cell elites. '
             'Legend: candidate shapes, a fitness colour scale from low to high, and markers for parent, child and other candidates.">', svg, count=1)
html = (tpl.replace("__TEASER_SVG__", svg).replace("__LINEAGES_JSON__", js(lin)).replace("__VIDEOS_JSON__", js(vid)).replace("__CURVES_JSON__", js(cur)).replace("__ANATOMY_JSON__", js(ana)).replace("__CASES_JSON__", js(cases))
           .replace("__STORYBOARD_SVG__", STORY))
# BALROG grid videos: render the four players statically
grids = ""
for g in vid["balrog"]["grids"]:
    grids += (f'<div class="player"><video controls muted playsinline preload="none" poster="{g["poster"]}" src="{g["file"]}" width="{g["w"]}" height="{g["h"]}"></video>'
              f'<div class="cap"><span class="text"><b>{g["task"]}</b>, episode {g["episode"].split()[-1][-2:]}: anchor, cand_r35_0, cand_r41_0, cand_r68_0</span></div></div>')
html = html.replace('<div class="vgrid two" id="grids-balrog"></div>', f'<div class="vgrid two" id="grids-balrog">{grids}</div>')
(SITE / "index.html").write_text(html)
# link check: every local reference must exist
missing = []
for ref in set(re.findall(r'(?:src|href|poster)="(static/[^"]+)"', html)):
    if not (SITE / ref).exists(): missing.append(ref)
for section in [vid["balrog"]["mazewalk"], vid["balrog"]["grids"], vid["nav"]] + list(vid["games"].values()):
    for e in section:
        for k in ("file", "poster"):
            if e.get(k) and not (SITE / e[k]).exists(): missing.append(e[k])
left = re.findall(r"__[A-Z_]+__", html)
print("index.html bytes:", len(html), "| missing local refs:", missing or "none", "| unreplaced placeholders:", left or "none")
