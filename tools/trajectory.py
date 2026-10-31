#!/usr/bin/env python3
"""Export the BALROG-MiniHack adaptive k0=16 search (the run behind Table 1) as a step-by-step archive trajectory.
Sources: the run's RESULT.json (frontier trace: every active cell per round with its members and elite, the split and
retreat events) and the driver log (the cell every harness was placed in, its parent and the directive's target cell).
Writes static/data/trajectory.json for the method section's "A real search trajectory" panel."""
import json, re
from pathlib import Path
import numpy as np
A = Path("/home/azureuser/workspace/AutoSpatial/balrog/balrog_ours")
RUN = A / "runs/adaptive_k16_c1p4"
SITE = Path(__file__).resolve().parent.parent
R = json.load(open(RUN / "RESULT.json")); F = R["frontier"]; hist = R["history"]
log = (A / "runs/adaptive_k16_c1p4.log").read_text().splitlines()
short = lambda lab: "anchor" if lab.startswith("anchor") else re.sub(r"^cand_r0*(\d+)_\d+_.*$", r"r\1", lab)
# ---- placements from the log: cell, parent, steer target, round (0 = coverage initialization)
PL = re.compile(r"\[frontier\] (?:INIT coverage pass \d+ \(pre-generation, founder depth=1\)|round (\d+)): cell (\d+) \(d\d\) <- (\S+) primary=([0-9.]+)\s*(\[new elite\])?\s*\(parent=(\S+)@cell (\d+), steer->(\S+)\)")
placed = {}
for ln in log:
    m = PL.search(ln)
    if m:
        rnd, cell, lab, fit, newel, par, pcell, steer = m.groups()
        placed[short(lab)] = {"step": int(rnd) if rnd else 0, "cell": int(cell), "fit": float(fit), "new_elite": bool(newel),
                              "parent": short(par), "parent_cell": int(pcell), "steer": None if steer == "None" else int(steer)}
# ---- nodes from the history (evaluation order)
nodes, byshort = [], {}
for h in hist:
    g, lab = h["genome"], h["label"]; s = short(lab)
    fit = float(re.search(r"primary=([0-9.]+)", h["fit"]).group(1))
    vec = json.loads(re.search(r"vector=(\{[^}]*\})", h["fit"]).group(1).replace("'", '"'))
    pm = re.search(r"parent_dir=PosixPath\('([^']+)'\)", g)
    parent = short(Path(pm.group(1)).name) if pm else None
    p = placed.get(s)
    if s == "anchor": p = {"step": 0, "cell": 4, "fit": fit, "new_elite": True, "parent": None, "parent_cell": None, "steer": None}
    assert p is not None, f"no placement for {lab}"
    assert abs(p["fit"] - fit) < 1e-9, (lab, p["fit"], fit)
    if parent is not None: assert p["parent"] == parent, (lab, p["parent"], parent)
    n = {"i": h["iter"], "n": h["iter"] + 1, "label": s, "full": lab, "fit": fit, "vec": vec, "parent": None if parent is None else byshort[parent],
         "step": p["step"], "cell": p["cell"], "parent_cell": p["parent_cell"], "steer": p["steer"], "new_elite": p["new_elite"]}
    byshort[s] = n["i"]; nodes.append(n)
# ---- cells ever (tree) and the tile order of the 16 initial cells (first principal component of their centroids)
cells = {}
for snap in F["trace"]:
    for c in snap["cells"]:
        cells.setdefault(c["cid"], {"cid": c["cid"], "parent": c["parent"], "depth": c["depth"], "z": np.array(c["z"], float)})
init = sorted(c for c in cells if cells[c]["parent"] is None); assert len(init) == 16
Zi = np.array([cells[c]["z"] for c in init]); mu = Zi.mean(0); U, S, Vt = np.linalg.svd(Zi - mu, full_matrices=False)
order = [init[i] for i in np.argsort((Zi - mu) @ Vt[0])]
tree = {str(c): {"parent": cells[c]["parent"], "depth": cells[c]["depth"]} for c in sorted(cells)}
# ---- steps: 0 = after coverage-gated initialization (16 cells, founders in their log cells); t>=1 = the trace snapshot of round t
dirname_to_i = {}
for h, n in zip(hist, nodes):
    dirname_to_i[Path(re.search(r"source_dir=PosixPath\('([^']+)'\)", h["genome"]).group(1)).name] = n["i"]
def elite_of(members): return max(members, key=lambda i: (nodes[i]["fit"], -i)) if members else None
steps = []
mem0 = {c: [] for c in init}
for n in nodes:
    if n["step"] == 0: mem0[n["cell"]].append(n["i"])
steps.append({"t": 0, "n_evals": sum(1 for n in nodes if n["step"] == 0), "n_cells": 16, "occupied": sum(1 for m in mem0.values() if m),
              "best": max(n["fit"] for n in nodes if n["step"] == 0), "events": [],
              "cells": [{"cid": c, "parent": None, "depth": 0, "members": mem0[c], "elite": elite_of(mem0[c])} for c in init],
              "children": [n["i"] for n in nodes if n["step"] == 0]})
splits = {s["round"]: s for s in F["splits"]}; retreats = {r["round"]: r for r in F["retreats"]}
for snap in F["trace"][1:]:
    t = snap["round"]
    cs = []
    for c in snap["cells"]:
        mem = [dirname_to_i[m.split("/")[-1]] for m in c["members"]]
        e = elite_of(mem)
        if e is not None: assert abs(nodes[e]["fit"] - c["elite"]) < 1e-9, (t, c["cid"], nodes[e]["fit"], c["elite"])
        cs.append({"cid": c["cid"], "parent": c["parent"], "depth": c["depth"], "members": mem, "elite": e})
    ev = []
    if t in splits: s = splits[t]; ev.append({"kind": "split", "cell": s["cell"], "range": s["range"], "children": s["children"]})
    if t in retreats: r = retreats[t]; ev.append({"kind": "retreat", "parent": r["parent"], "merged": r["merged_subtree"], "pre_elite": r["pre_elite"], "best_desc": r["best_desc"]})
    kids = [n["i"] for n in nodes if n["step"] == t]
    steps.append({"t": t, "n_evals": sum(1 for n in nodes if n["step"] <= t), "n_cells": snap["n_cells"], "occupied": snap["occupied"], "best": snap["best"],
                  "events": ev, "cells": cs, "children": kids})
    assert len(kids) == 4, (t, kids)
# the split children must be known cells even when a later retreat removed them (17-20 at round 2)
for s in F["splits"]:
    for k in s["children"]: tree.setdefault(str(k), {"parent": s["cell"], "depth": tree[str(s["cell"])]["depth"] + 1})
best = max(nodes, key=lambda n: (n["fit"], -n["i"]))
path = []; cur = best["i"]
while cur is not None: path.append(cur); cur = nodes[cur]["parent"]
path.reverse()
out = {"bench": "BALROG-MiniHack", "run": "adaptive_k16_c1p4", "k0": 16, "P": 4, "C": 1, "N": len(nodes), "T": len(steps) - 1,
       "tasks": list(nodes[0]["vec"].keys()), "order": order, "tree": tree, "nodes": nodes, "steps": steps, "path": path,
       "best": {"i": best["i"], "label": best["label"], "fit": best["fit"], "n": best["n"]},
       "notes": "steps[0] is the archive after coverage-gated initialization (anchor + 7 founders); steps[t] is the archive after generation t "
                "(4 children placed, then at most one sub-split and any reversion). Tile order of the 16 initial cells follows the first principal "
                "component of their centroids; positions inside a tile are not meaningful."}
json.dump(out, open(SITE / "static/data/trajectory.json", "w"), separators=(",", ":"))
print("nodes", len(nodes), "steps", len(steps), "path", [nodes[i]["label"] for i in path], "order", order)
for s in steps: print(" t", s["t"], "evals", s["n_evals"], "cells", s["n_cells"], "occ", s["occupied"], "best", s["best"], "events", [(e["kind"], e.get("cell", e.get("parent"))) for e in s["events"]], "kids", [nodes[i]["label"] for i in s["children"]])
