#!/usr/bin/env python3
"""Export the search-dynamics series behind the paper's Figures 3, 4, 6, 7 and 8 to
static/data/curves.json for the page's interactive charts.

Sources are the same per-evaluation score logs and archive-resolution logs that produced the
paper's figures (AutoSpatial figure directories). Games aggregate = plain mean over the five
games (the paper's Table 1 / Figure 3 convention); BALROG aggregate = the 'ALL' task of the
canonical arms. Series are best-so-far step functions stored as [x, value%] breakpoints."""
import json, csv, collections
from pathlib import Path

A = Path("/home/azureuser/workspace/AutoSpatial")
SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "static/data/curves.json"
GAMES_METHOD = {"iris": "Meta-Harness", "dgm": "DGM", "gepa": "GEPA", "shinka": "ShinkaEvolve", "openevolve": "OpenEvolve"}
GAMES = ["maze", "maze3d_pro", "block3d", "rubik", "snake"]
GNAME = {"maze": "Maze", "maze3d_pro": "Maze3D", "block3d": "Block3D", "rubik": "Rubik", "snake": "Snake"}
QWEN = {"maze": 0.45, "maze3d_pro": 0.0, "block3d": 0.05, "rubik": 0.0, "snake": 0.063}   # direct inference, per game
K0S = [2, 4, 8, 16, 32]; MODES = ["adaptive", "fixed", "hier"]; NCAP = 50

def bsf(points):
    cur, out = 0.0, {}
    for x, y in sorted(points): cur = max(cur, y); out[x] = cur
    return out
def at(curve, x):
    ks = [k for k in curve if k <= x]; return curve[max(ks)] if ks else 0.0
def dense(curves, axis):
    """mean over curves, evaluated on every integer x up to the last x (n capped at NCAP)."""
    curves = [c for c in curves if c]
    if not curves: return []
    xmax = max(max(c) for c in curves); xmax = min(xmax, NCAP) if axis == "n" else xmax
    xs = range(1 if axis == "n" else 0, xmax + 1)
    return [[x, round(100 * sum(at(c, x) for c in curves) / len(curves), 2)] for x in xs]
def compact(pts):
    return [[x, y] for i, (x, y) in enumerate(pts) if i == 0 or y != pts[i - 1][1] or i == len(pts) - 1]
def pair(curves_n, curves_t, extra=None):
    d = {"n": compact(dense(curves_n, "n")), "t": compact(dense(curves_t, "t"))}
    if extra: d.update(extra)
    return d

# ------------------------------------------------------------------ games
G = [a for a in json.load(open(A / "spatial_world/figures/figs_3dgames_codex/score_log_tableA_gpt.json"))["arms"] if a.get("trajectory")]
def tcurve(a, axis): return bsf([(r[axis], r["best_so_far"]) for r in a["trajectory"]])
dup = collections.Counter((a["method"], a.get("mode"), a.get("k0"), a["game"]) for a in G)
print("games: duplicate (method,mode,k0,game) cells:", {k: v for k, v in dup.items() if v > 1} or "none")
games = {"agg": {"anchor": round(100 * sum(QWEN.values()) / 5, 1), "baselines": {}, "ours": {m: {} for m in MODES}},
         "pergame": {}, "order": GAMES, "names": GNAME}
for key, name in GAMES_METHOD.items():
    arms = [a for a in G if a["method"] == key]
    games["agg"]["baselines"][name] = pair([tcurve(a, "n") for a in arms], [tcurve(a, "t") for a in arms], {"games": len(arms)})
for m in MODES:
    for k in K0S:
        arms = [a for a in G if a["method"] == "ours" and a["mode"] == m and a["k0"] == k]
        if len(arms) < 4: print(f"games: skip {m} k0={k} ({len(arms)} games)"); continue
        games["agg"]["ours"][m][str(k)] = pair([tcurve(a, "n") for a in arms], [tcurve(a, "t") for a in arms], {"games": len(arms)})
for g in GAMES:
    pg = {"name": GNAME[g], "anchor": round(100 * QWEN[g], 1), "baselines": {}, "ours": {m: {} for m in MODES}}
    for key, name in GAMES_METHOD.items():
        a = next((a for a in G if a["method"] == key and a["game"] == g), None)
        if a: pg["baselines"][name] = pair([tcurve(a, "n")], [tcurve(a, "t")])
    for m in MODES:
        for k in K0S:
            a = next((a for a in G if a["method"] == "ours" and a["mode"] == m and a["k0"] == k and a["game"] == g), None)
            if a: pg["ours"][m][str(k)] = pair([tcurve(a, "n")], [tcurve(a, "t")])
    games["pergame"][g] = pg

# ------------------------------------------------------------------ BALROG
B = [r for r in json.load(open(A / "balrog/figures/score_log_balrog.json")) if r["canonical"]]
S = json.load(open(A / "balrog/figures/series.json")); anchor = S["anchor"]
print("balrog series.json 'tasks' type:", type(S["tasks"]).__name__, (list(S["tasks"].items())[:2] if isinstance(S["tasks"], dict) else S["tasks"][:2]))
print("balrog anchor keys:", list(anchor.keys()))
def bcurve(method, mode, k0, task, axis):
    rows = [r for r in B if r["method"] == method and (mode is None or r["mode"] == mode) and (k0 is None or r["k0"] == k0) and r["task"] == task]
    return bsf([(r[axis], r["best_so_far"]) for r in rows]) if rows else {}
def bpair(method, mode, k0, task):
    cn, ct = bcurve(method, mode, k0, task, "n"), bcurve(method, mode, k0, task, "t")
    return pair([cn], [ct]) if cn else None
tasks = sorted({r["task"] for r in B if r["task"] != "ALL"})
balrog = {"agg": {"anchor": {"mean": round(100 * anchor["mean"], 1), "min": round(100 * anchor["min"], 1), "max": round(100 * anchor["max"], 1), "n": anchor.get("n")},
                  "baselines": {}, "ours": {m: {} for m in MODES}}, "pertask": {}, "order": tasks}
for name in ["Meta-Harness", "DGM", "GEPA", "ShinkaEvolve", "OpenEvolve"]:
    p = bpair(name, None, None, "ALL")
    if p: balrog["agg"]["baselines"][name] = p
for m in MODES:
    for k in K0S:
        p = bpair("ours", m, k, "ALL")
        if p: balrog["agg"]["ours"][m][str(k)] = p
for t in tasks:
    pt = {"name": t, "baselines": {}, "ours": {m: {} for m in MODES}}
    an = [r for r in B if r["method"] == "qwen_naive" and r["task"] == t]
    if an: pt["anchor"] = round(100 * an[0]["primary"], 1)
    for name in ["Meta-Harness", "DGM", "GEPA", "ShinkaEvolve", "OpenEvolve"]:
        p = bpair(name, None, None, t)
        if p: pt["baselines"][name] = p
    for m in MODES:
        for k in K0S:
            p = bpair("ours", m, k, t)
            if p: pt["ours"][m][str(k)] = p
    balrog["pertask"][t] = pt

# ------------------------------------------------------------------ archive resolution (cells vs step T)
res = {"games": {}, "balrog": []}
rows = list(csv.DictReader(open(A / "spatial_world/figures/figs_3dgames_codex/resolution_log_3dgames_codex.csv")))
by = collections.defaultdict(list)
for r in rows: by[(r["game"], r["mode"], int(r["k0"]))].append(r)
for (g, m, k), rs in sorted(by.items(), key=lambda kv: (GAMES.index(kv[0][0]), kv[0][1], kv[0][2])):
    keep = {int(r["step"]): int(r["n_cells"]) for r in rs}
    if 0 not in keep: keep[0] = k                                  # the archive is created with k0 cells
    res["games"].setdefault(g, []).append({"mode": m, "k0": k, "exact": all(r["trace_source"] == "log-exact" for r in rs),
                                           "pts": [[x, keep[x]] for x in sorted(keep)]})
rows = [r for r in csv.DictReader(open(A / "balrog/figures/resolution_log_balrog.csv")) if r["canonical"] == "True"]
by = collections.defaultdict(list)
for r in rows: by[(r["mode"], int(r["k0"]))].append(r)
for (m, k), rs in sorted(by.items()):
    keep = {int(r["step"]): int(r["n_cells"]) for r in rs}
    if 0 not in keep: keep[0] = k
    res["balrog"].append({"mode": m, "k0": k, "exact": True, "pts": [[x, keep[x]] for x in sorted(keep)]})

# ------------------------------------------------------------------ SimWorld-MMNav (easy = paper's "simple", hard); budget N = 16
NAV_METHOD = {"IRIS": "Meta-Harness", "DGM": "DGM", "GEPA": "GEPA", "ShinkaEvolve": "ShinkaEvolve", "OpenEvolve": "OpenEvolve"}
NAV_CAP = 16
nav = {}
for key, sub in (("nav_easy", "nav_simple"), ("nav_hard", "nav_hard")):
    rows = [r for r in json.load(open(A / f"{sub}/figures/score_log_{sub}.json")) if r["canonical"] and r["task"].startswith("search") and r["best_so_far"] != ""]
    S = json.load(open(A / f"{sub}/figures/series.json")); an = S["anchor"]
    def ncurve(method, k0=None, axis="n"):
        rs = [r for r in rows if r["method"] == method and (k0 is None or r["k0"] == k0) and r["n"] <= NAV_CAP]
        return bsf([(r[axis], r["best_so_far"]) for r in rs]) if rs else {}
    def npair(method, k0=None):
        cn = ncurve(method, k0, "n"); ct = ncurve(method, k0, "t")
        if not cn: return None
        d = {"n": compact([[x, y] for x, y in dense([cn], "n") if x <= NAV_CAP]), "t": compact(dense([ct], "t"))}
        return d
    block = {"anchor": {"mean": round(100 * an["mean"], 1), "min": round(100 * an["min"], 1), "max": round(100 * an["max"], 1), "n": an["n"]},
             "baselines": {}, "ours": {"adaptive": {}, "fixed": {}, "hier": {}}, "h0": None}
    for raw, name in NAV_METHOD.items():
        pr = npair(raw)
        if pr: block["baselines"][name] = pr
    for k in (2, 4, 8):
        pr = npair("ours", k)
        if pr: block["ours"]["adaptive"][str(k)] = pr
    nav[key] = {"agg": block, "pertask": {}, "order": []}
    print(key, "endpoints:", {n: v["n"][-1] for n, v in block["baselines"].items()}, {k: v["n"][-1] for k, v in block["ours"]["adaptive"].items()}, "anchor", block["anchor"])
# resolution: hard has per-step traces; easy persisted only the final archive size -> k0 -> final endpoint, flagged inexact
res["nav_hard"] = []
rows = [r for r in csv.DictReader(open(A / "nav_hard/figures/resolution_log_nav_hard.csv")) if r["mode"] == "adaptive" and r["step"] != ""]
by = collections.defaultdict(dict)
for r in rows: by[int(r["k0"])][int(r["step"])] = int(r["n_cells"])
for k, keep in sorted(by.items()):
    if 0 not in keep: keep[0] = k
    res["nav_hard"].append({"mode": "adaptive", "k0": k, "exact": True, "pts": [[x, keep[x]] for x in sorted(keep)]})
res["nav_easy"] = []
import re as _re
for r in csv.DictReader(open(A / "nav_simple/figures/resolution_log_nav_simple.csv")):
    if r["mode"] != "adaptive" or r["round_as_run"] != "FINAL" or r["canonical"] != "True": continue
    m = _re.search(r"rounds=(\d+)", r["note"]); rounds = int(m.group(1)) if m else 1
    res["nav_easy"].append({"mode": "adaptive", "k0": int(r["k0"]), "exact": False, "pts": [[0, int(r["k0"])], [rounds, int(r["n_cells"])]]})
print("resolution nav_hard:", [(s["k0"], s["pts"][-1]) for s in res["nav_hard"]], "| nav_easy endpoints:", [(s["k0"], s["pts"]) for s in res["nav_easy"]])

data = {"games": games, "balrog": balrog, "nav_easy": nav["nav_easy"], "nav_hard": nav["nav_hard"], "resolution": res,
        "meta": {"baselines": ["Meta-Harness", "DGM", "GEPA", "ShinkaEvolve", "OpenEvolve"], "k0": K0S, "modes": MODES, "ncap": NCAP}}
OUT.write_text(json.dumps(data, separators=(",", ":")))
print("wrote", OUT, OUT.stat().st_size, "bytes")
# sanity: endpoints that must match the paper's tables
print("games agg endpoints:", {n: v["n"][-1] for n, v in games["agg"]["baselines"].items()}, {m: {k: v["n"][-1] for k, v in d.items()} for m, d in games["agg"]["ours"].items()})
print("balrog agg endpoints:", {n: v["n"][-1] for n, v in balrog["agg"]["baselines"].items()}, {m: {k: v["n"][-1] for k, v in d.items()} for m, d in balrog["agg"]["ours"].items()})
print("resolution games cells:", {g: [(s["mode"], s["k0"], len(s["pts"]), s["exact"]) for s in ss] for g, ss in res["games"].items()})
print("resolution balrog:", [(s["mode"], s["k0"], len(s["pts"]), s["pts"][-1]) for s in res["balrog"]])
