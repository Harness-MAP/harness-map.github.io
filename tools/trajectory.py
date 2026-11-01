#!/usr/bin/env python3
"""Export one real Harness-MAP run as the data behind the method section's search-trajectory panel.

Source: a BALROG arm's RESULT.json (history, frontier trace with every cell's centroid, splits, retreats) plus its driver
log (which cell each evaluated harness was placed in, its parent and its directive target).  The archive's cells are
drawn as a Voronoi tessellation of the cell centroids projected to two principal components (each scaled to the same range); a sub-split divides the
parent's polygon along the bisector of its two children, so children nest inside their parent exactly as in the run.
Where a harness sits inside its cell is a deterministic layout, not its descriptor.  Writes static/data/trajectory.json."""
import ast, json, math, re, sys
from pathlib import Path
import numpy as np
A = Path("/home/azureuser/workspace/AutoSpatial/balrog/balrog_ours")
RUN_NAME = sys.argv[1] if len(sys.argv) > 1 else "adaptive_k8_c1"
RUN = A / "runs" / RUN_NAME; SITE = Path(__file__).resolve().parent.parent
R = json.load(open(RUN / "RESULT.json")); FR = R["frontier"]; HIST = R["history"]
LOG = (A / "runs" / f"{RUN_NAME}.log").read_text().splitlines()
PL = re.compile(r"\[frontier\] (?:INIT coverage pass \d+ \(pre-generation, founder depth=\d\)|round (\d+)): cell (\d+) \(d\d\) <- (\S+) primary=([0-9.]+)\s*(\[new elite\])?\s*\(parent=(\S+)@cell (\d+), steer->(\S+)\)")

# ---------------------------------------------------------------- nodes: every evaluated harness, in evaluation order
def short(label): return "anchor" if label.startswith("anchor") else re.sub(r"^cand_r0*(\d+)_.*$", r"r\1", label)
nodes, by_label, by_dir = [], {}, {}
for n, h in enumerate(HIST):
    g, f = h["genome"], h["fit"]
    src = Path(re.search(r"source_dir=PosixPath\('([^']+)'\)", g).group(1)).name
    vec = ast.literal_eval(re.search(r"vector=(\{[^}]*\})", f).group(1))
    node = dict(i=n, n=n + 1, label=h["label"], short=short(h["label"]), fit=float(re.search(r"primary=([0-9.]+)", f).group(1)),
                vec={k.split("/")[-1]: round(v, 3) for k, v in vec.items()}, cell=None, parent=None, steer=None, round=None)
    nodes.append(node); by_label[h["label"]] = node; by_dir[src] = node
anchor = nodes[0]
for l in LOG:
    m = PL.search(l)
    if not m: continue
    nd = by_label.get(m.group(3))
    if nd is None: continue
    nd["cell"] = int(m.group(2)); nd["round"] = int(m.group(1) or 0); st = m.group(8); nd["steer"] = None if st == "None" else int(st)
    p = m.group(6); nd["parent"] = anchor["i"] if p.startswith("anchor") else by_label[p]["i"]
    if anchor["cell"] is None and p.startswith("anchor"): anchor["cell"] = int(m.group(7))
anchor["round"] = 0
def node_of(path):
    nm = Path(path).name
    if nm.startswith("anchor"): return anchor["i"]
    return by_dir[nm]["i"]

# ---------------------------------------------------------------- cells: every cell that ever existed, with its centroid
cells = {}
for t in FR["trace"]:
    for c in t["cells"]:
        if c["cid"] not in cells: cells[c["cid"]] = dict(cid=c["cid"], depth=c["depth"], parent=c["parent"], z=np.array(c["z"], float))
roots = sorted(c for c, v in cells.items() if v["depth"] == 0)
Z = np.stack([cells[c]["z"] for c in sorted(cells)]); mu = Z.mean(0); U, S, Vt = np.linalg.svd(Z - mu, full_matrices=False)
P2 = {c: ((cells[c]["z"] - mu) @ Vt[:2].T) for c in sorted(cells)}
var = (S ** 2) / (S ** 2).sum()
# the first component carries almost all of the centroid variance, so each component is scaled to the same range before the
# tessellation is drawn: the cells stay irregular Voronoi regions of the projected centroids but the map is not a stack of bands
_all = np.array([P2[c] for c in roots]); _lo, _hi = _all.min(0), _all.max(0)   # the root cells define the map's extent
P2 = {c: (P2[c] - _lo) / np.maximum(_hi - _lo, 1e-9) for c in P2}
pts = np.array([P2[c] for c in roots]); lo, hi = pts.min(0), pts.max(0); pad = 0.22 * (hi - lo).max() + 1e-9
box = [(lo[0] - pad, lo[1] - pad), (hi[0] + pad, lo[1] - pad), (hi[0] + pad, hi[1] + pad), (lo[0] - pad, hi[1] + pad)]

def clip(poly, a, b):
    """Keep the part of convex polygon `poly` closer to point a than to point b (Sutherland–Hodgman against the bisector)."""
    a, b = np.asarray(a), np.asarray(b); nrm = b - a; mid = (a + b) / 2
    inside = lambda p: (np.asarray(p) - mid) @ nrm <= 0
    out = []
    for k in range(len(poly)):
        p, q = np.asarray(poly[k]), np.asarray(poly[(k + 1) % len(poly)]); pi, qi = inside(p), inside(q)
        if pi: out.append(tuple(p))
        if pi != qi:
            dp, dq = (p - mid) @ nrm, (q - mid) @ nrm; t = dp / (dp - dq); out.append(tuple(p + t * (q - p)))
    return out
def area(poly):
    if len(poly) < 3: return 0.0
    x, y = np.array(poly).T; return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
def centroid(poly):
    x, y = np.array(poly).T; cr = x * np.roll(y, -1) - np.roll(x, -1) * y; a = cr.sum() / 2
    if abs(a) < 1e-12: return np.array([x.mean(), y.mean()])
    return np.array([((x + np.roll(x, -1)) * cr).sum() / (6 * a), ((y + np.roll(y, -1)) * cr).sum() / (6 * a)])
def inradius(poly, c):
    d = []
    for k in range(len(poly)):
        p, q = np.array(poly[k]), np.array(poly[(k + 1) % len(poly)]); v = q - p; L = np.dot(v, v)
        t = 0 if L == 0 else max(0, min(1, np.dot(c - p, v) / L)); d.append(np.linalg.norm(c - (p + t * v)))
    return min(d)
def inside_poly(poly, p):
    x, y = p; n = len(poly); ins = False
    for k in range(n):
        x1, y1 = poly[k]; x2, y2 = poly[(k + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-18) + x1: ins = not ins
    return ins

POLY = {}
for c in roots:
    poly = box
    for o in roots:
        if o != c: poly = clip(poly, P2[c], P2[o])
    POLY[c] = poly
for sp in sorted(FR["splits"], key=lambda s: s["round"]):
    parent, (ca, cb) = sp["cell"], sp["children"]
    base = POLY[parent]; pa, pb = clip(base, P2[ca], P2[cb]), clip(base, P2[cb], P2[ca])
    if min(area(pa), area(pb)) < 0.04 * area(base):  # projection put a child outside its parent: split through the parent's centroid instead
        cen = centroid(base); d = P2[cb] - P2[ca]
        if np.linalg.norm(d) < 1e-9: d = np.array([1.0, 0.0])
        d = d / np.linalg.norm(d); pa, pb = clip(base, cen - d, cen + d), clip(base, cen + d, cen - d)
    POLY[ca], POLY[cb] = pa, pb

def layout(poly, members):
    """Deterministic sunflower layout of a cell's members inside its polygon (positions are schematic)."""
    c = centroid(poly); r_in = inradius(poly, c); n = len(members); out = {}
    s = 0.78 * r_in / math.sqrt(max(n, 1) - 0.5) if n > 1 else 0
    for k, i in enumerate(members):
        if n == 1: out[i] = c; continue
        th = k * 2.399963; p = c + s * math.sqrt(k + 0.5) * np.array([math.cos(th), math.sin(th)])
        tries = 0
        while not inside_poly(poly, p) and tries < 20: p = c + 0.85 * (p - c); tries += 1
        out[i] = p
    return out

# ---------------------------------------------------------------- steps: 0 = after coverage initialization, then one per round
steps = []
founders = [nd["i"] for nd in nodes if nd["round"] == 0]
t0 = FR["trace"][0]
members0 = {c["cid"]: [] for c in t0["cells"]}
for i in founders: members0.setdefault(nodes[i]["cell"], []).append(i)
def mk_step(t, rnd, cell_list, members, kids, event):
    elites = {}
    for cid, ms in members.items():
        if ms: elites[cid] = max(ms, key=lambda i: (nodes[i]["fit"], -i))
    placed = [nd for nd in nodes if nd["round"] is not None and nd["round"] <= rnd]
    best = max(placed, key=lambda nd: (nd["fit"], -nd["i"]))
    pos = {}
    for cid, ms in members.items():
        if ms: pos.update({i: p for i, p in layout(POLY[cid], sorted(ms)).items()})
    return dict(t=t, round=rnd, cells=cell_list, members={str(k): sorted(v) for k, v in members.items() if v}, elites={str(k): v for k, v in elites.items()},
                kids=kids, event=event, evals=len(placed), occupied=sum(1 for v in members.values() if v), n_cells=len(cell_list), best=best["i"],
                pos={str(i): [round(float(p[0]), 4), round(float(p[1]), 4)] for i, p in pos.items()})
steps.append(mk_step(0, 0, [c["cid"] for c in t0["cells"]], members0, founders, dict(kind="init", founders=len(founders), target=FR["init"].get("M"))))
for tr in FR["trace"][1:]:
    rnd = tr["round"]; members = {c["cid"]: [node_of(m) for m in c["members"]] for c in tr["cells"]}
    kids = [nd["i"] for nd in nodes if nd["round"] == rnd]
    ev = None
    sp = [s for s in FR["splits"] if s["round"] == rnd]; rt = [r for r in FR["retreats"] if r["round"] == rnd]
    if sp: ev = dict(kind="split", cell=sp[0]["cell"], children=sp[0]["children"], range=sp[0].get("range"))
    if rt: ev = dict(kind="retreat", parents=[r["parent"] for r in rt], merged=[r["merged_subtree"] for r in rt], pre_elite=[r.get("pre_elite") for r in rt])
    if sp and rt: ev["also_split"] = dict(cell=sp[0]["cell"], children=sp[0]["children"])
    steps.append(mk_step(len(steps), rnd, [c["cid"] for c in tr["cells"]], members, kids, ev))

best = max(nodes, key=lambda nd: (nd["fit"], -nd["i"])); path = [best["i"]]
while nodes[path[-1]]["parent"] is not None and nodes[path[-1]]["parent"] not in path: path.append(nodes[path[-1]]["parent"])
path = path[::-1]

# ---------------------------------------------------------------- normalize geometry to the unit square and write
allpts = np.array([p for poly in POLY.values() for p in poly]); lo, hi = allpts.min(0), allpts.max(0); span = (hi - lo).max()
norm = lambda p: [round(float((p[0] - lo[0]) / span), 4), round(float(1 - (p[1] - lo[1]) / span), 4)]
out = dict(bench="BALROG-MiniHack", run=RUN_NAME, k0=FR["k0"], P=FR["budget"]["P"], C=FR["budget"]["C"], N=FR["budget"]["N_realized"], G=FR["budget"]["G_ran"], M=FR["init"]["M"],
           pca_var=[round(float(v), 3) for v in var[:2]], roots=roots, best=best["i"], path=path,
           cells={str(c): dict(cid=c, depth=cells[c]["depth"], parent=cells[c]["parent"], poly=[norm(p) for p in POLY[c]], c=norm(centroid(POLY[c]))) for c in POLY},
           nodes=[dict(i=nd["i"], n=nd["n"], label=nd["label"], short=nd["short"], fit=nd["fit"], vec=nd["vec"], cell=nd["cell"], parent=nd["parent"], steer=nd["steer"], round=nd["round"]) for nd in nodes],
           steps=[dict(s, pos={k: norm(v) for k, v in s["pos"].items()}) for s in steps],
           aspect=round(float((hi[1] - lo[1]) / (hi[0] - lo[0])), 4))
(SITE / "static/data/trajectory.json").write_text(json.dumps(out, separators=(",", ":")))
print("run", RUN_NAME, "nodes", len(nodes), "steps", len(steps), "cells", len(POLY), "pca var", out["pca_var"], "best", best["short"], best["fit"], "path", [nodes[i]["short"] + "@" + str(nodes[i]["cell"]) for i in path])
print("missing placements:", [nd["label"] for nd in nodes if nd["cell"] is None], "| bytes", (SITE / "static/data/trajectory.json").stat().st_size)
for s in steps[:6] + steps[-2:]: print(" step", s["t"], "round", s["round"], "evals", s["evals"], "occ", s["occupied"], "/", s["n_cells"], "best", nodes[s["best"]]["fit"], "event", (s["event"] or {}).get("kind"), "kids", [nodes[i]["short"] for i in s["kids"]])
