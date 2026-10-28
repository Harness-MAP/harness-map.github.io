import math, random
from pathlib import Path
OUT = Path("/home/azureuser/workspace/harness-evolution.github.io/static/img")
random.seed(7)
# ---- convex polygon clipping by half-plane {p : (p - a)·(b - a) <= |b-a|^2/2}  i.e. closer to a than b
def clip_halfplane(poly, a, b):
    mx, my = (a[0]+b[0])/2, (a[1]+b[1])/2; nx, ny = b[0]-a[0], b[1]-a[1]
    def inside(p): return (p[0]-mx)*nx + (p[1]-my)*ny <= 1e-12
    def inter(p, q):
        dp = (p[0]-mx)*nx + (p[1]-my)*ny; dq = (q[0]-mx)*nx + (q[1]-my)*ny; t = dp/(dp-dq)
        return (p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1]))
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i+1) % len(poly)]
        if inside(p):
            out.append(p)
            if not inside(q): out.append(inter(p, q))
        elif inside(q): out.append(inter(p, q))
    return out
def voronoi(seeds, region):
    cells = []
    for i, a in enumerate(seeds):
        poly = region
        for j, b in enumerate(seeds):
            if i != j: poly = clip_halfplane(poly, a, b)
        cells.append(poly)
    return cells
def centroid(poly):
    A = cx = cy = 0
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i+1) % len(poly)]; c = x0*y1 - x1*y0; A += c; cx += (x0+x1)*c; cy += (y0+y1)*c
    A *= 0.5; return (cx/(6*A), cy/(6*A))
def inside_poly(p, poly):
    s = None
    for i in range(len(poly)):
        a, b = poly[i], poly[(i+1) % len(poly)]; cr = (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])
        if abs(cr) < 1e-12: continue
        if s is None: s = cr > 0
        elif (cr > 0) != s: return False
    return True
SQ = [(0,0),(1,0),(1,1),(0,1)]
seeds = [(0.18,0.22),(0.52,0.18),(0.84,0.30),(0.30,0.55),(0.66,0.56),(0.20,0.85),(0.56,0.86),(0.88,0.78)]
cells = voronoi(seeds, SQ)
# fitness landscape: two bumps
def fit(p):
    def bump(c, s): return math.exp(-((p[0]-c[0])**2 + (p[1]-c[1])**2) / (2*s*s))
    return min(1, 0.15 + 0.85*bump((0.66,0.56), 0.13) + 0.55*bump((0.22,0.84), 0.16))
pts = []
while len(pts) < 46:
    p = (random.random(), random.random())
    if all((p[0]-q[0])**2 + (p[1]-q[1])**2 > 0.0035 for q, _ in pts): pts.append((p, fit(p)))
# ---- colors
PASTEL = ["#fde2e2", "#ffe6d1", "#fff4cc", "#e3f3dc", "#d9f1ee", "#dbe9f8", "#e8e2f6", "#f6e3ee"]
EDGE = ["#e58a8a", "#f0ad6f", "#e3c45a", "#8fc981", "#6fc3b8", "#7aa8e0", "#a08fd8", "#d78cb8"]
RAMP = ["#f28c52","#ea6c34","#d4521f","#b23d14","#8a2d0e","#5e1d08"]  # one-hue sequential (validated)
def fcol(v): return RAMP[min(len(RAMP)-1, int(v*len(RAMP)))]
W = 250; PAD = 8
def X(x): return PAD + x*(W-2*PAD)
def Y(y): return PAD + (1-y)*(W-2*PAD)
def path(poly): return "M" + " L".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in poly) + " Z"
def dots(extra=""):
    s = ""
    for (p, v) in pts:
        s += f'<circle cx="{X(p[0]):.1f}" cy="{Y(p[1]):.1f}" r="4.2" fill="{fcol(v)}" stroke="#fff" stroke-width="1.2"{extra}/>'
    return s
def panel_a():
    s = f'<rect x="{PAD}" y="{PAD}" width="{W-2*PAD}" height="{W-2*PAD}" fill="#f7f7f5" stroke="#bbb" stroke-width="1"/>'
    for i in range(1, 5):
        t = PAD + i*(W-2*PAD)/5
        s += f'<line x1="{t:.1f}" y1="{PAD}" x2="{t:.1f}" y2="{W-PAD}" stroke="#bbb" stroke-width="1"/><line x1="{PAD}" y1="{t:.1f}" x2="{W-PAD}" y2="{t:.1f}" stroke="#bbb" stroke-width="1"/>'
    return s + dots()
def panel_b():
    s = ""
    for i, c in enumerate(cells):
        s += f'<path d="{path(c)}" fill="{PASTEL[i]}" stroke="{EDGE[i]}" stroke-width="1.3" stroke-dasharray="4 3"/>'
    for sd in seeds: s += f'<circle cx="{X(sd[0]):.1f}" cy="{Y(sd[1]):.1f}" r="2" fill="#555"/>'
    return s + dots()
def panel_c():
    s = ""
    # sub-split the two high-variance cells (around the bumps): cells 4 and 5 (seeds (0.66,0.56) and (0.20,0.85))
    split = {4: [(0.60,0.50),(0.72,0.62),(0.62,0.66)], 5: [(0.14,0.80),(0.27,0.90)]}
    for i, c in enumerate(cells):
        if i in split:
            subs = voronoi(split[i], c)
            for k, sc in enumerate(subs):
                s += f'<path d="{path(sc)}" fill="{PASTEL[i]}" stroke="{EDGE[i]}" stroke-width="1.3" stroke-dasharray="4 3"/>'
                s += f'<path d="{path(sc)}" fill="none" stroke="{EDGE[i]}" stroke-width="1.6"/>'
                cx, cy = centroid(sc); s += f'<circle cx="{X(cx):.1f}" cy="{Y(cy):.1f}" r="2" fill="#555"/>'
        else:
            s += f'<path d="{path(c)}" fill="{PASTEL[i]}" stroke="{EDGE[i]}" stroke-width="1.3" stroke-dasharray="4 3"/>'
            s += f'<circle cx="{X(seeds[i][0]):.1f}" cy="{Y(seeds[i][1]):.1f}" r="2" fill="#555"/>'
    return s + dots()
LEG = "".join(f'<rect x="{i*14}" y="0" width="14" height="10" fill="{c}"/>' for i, c in enumerate(RAMP))
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {3*W+2*34} {W+62}" font-family="Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="12">
<style>.cap{{fill:#333;font-weight:600}} .ax{{fill:#666;font-size:10.5px}}</style>
<g transform="translate(0,0)">{panel_a()}</g>
<g transform="translate({W+34},0)">{panel_b()}</g>
<g transform="translate({2*W+68},0)">{panel_c()}
<text class="ax" x="{W/2:.0f}" y="{W+6}" text-anchor="middle">structure descriptor φₛ</text>
<text class="ax" transform="translate(-1,{W/2:.0f}) rotate(-90)" text-anchor="middle">token descriptor φₜ</text></g>
<text class="cap" x="{W/2:.0f}" y="{W+24}" text-anchor="middle">(a) MAP-Elites: fixed grid</text>
<text class="cap" x="{W+34+W/2:.0f}" y="{W+24}" text-anchor="middle">(b) CVT-MAP-Elites: fixed Voronoi cells</text>
<text class="cap" x="{2*W+68+W/2:.0f}" y="{W+24}" text-anchor="middle">(c) Harness-MAP: adaptive resolution</text>
<g transform="translate({W+34},{W+40})"><text class="ax" x="-6" y="9" text-anchor="end">fitness  low</text>{LEG}<text class="ax" x="{len(RAMP)*14+6}" y="9">high</text></g>
<g transform="translate({2*W+68+40},{W+40})"><line x1="0" y1="5" x2="26" y2="5" stroke="{EDGE[4]}" stroke-width="1.6"/><text class="ax" x="32" y="9">sub-split cell (high fitness range)</text></g>
</svg>'''
(OUT/"fig5_partitioning.svg").write_text(svg)
print("fig5 written", len(svg))

# ---- favicon / logo: a small voronoi map with shapes
S2 = [(0.25,0.28),(0.72,0.25),(0.30,0.72),(0.74,0.70),(0.52,0.5)]
cs = voronoi(S2, SQ)
def P2(poly, sz=64, pad=4): return "M" + " L".join(f"{pad+x*(sz-2*pad):.1f},{pad+(1-y)*(sz-2*pad):.1f}" for x, y in poly) + " Z"
FILL = ["#fde2e2", "#fff4cc", "#dbe9f8", "#e3f3dc", "#ffe6d1"]; ED = ["#e58a8a", "#e3c45a", "#7aa8e0", "#8fc981", "#f0ad6f"]
shapes = [
 '<polygon points="17,14 23,24 11,24" fill="#eb6834"/>',           # triangle (red-orange)
 '<circle cx="47" cy="17" r="5" fill="#eda100"/>',                  # circle (yellow)
 '<rect x="14" y="42" width="9" height="9" fill="#2a78d6"/>',       # square (blue)
 '<polygon points="48,42 54,46 52,53 44,53 42,46" fill="#1baf7a"/>',# pentagon (green)
 '<polygon points="32,27 37,32 32,37 27,32" fill="#e87ba4"/>',      # diamond (magenta)
]
fav = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="12" fill="#ffffff" stroke="#c9ccd3" stroke-width="2"/>' + \
      "".join(f'<path d="{P2(c)}" fill="{FILL[i]}" stroke="{ED[i]}" stroke-width="1.4" stroke-dasharray="3 2"/>' for i, c in enumerate(cs)) + "".join(shapes) + "</svg>"
(OUT/"favicon.svg").write_text(fav); print("favicon written")
