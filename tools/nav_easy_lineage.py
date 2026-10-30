#!/usr/bin/env python3
"""Add the SimWorld-MMNav easy run (adaptive, k0 = 2) to static/data/lineages.json from its archived
adaptive_history.json: one row per evaluated harness in evaluation order with its parent and score."""
import json, re
from pathlib import Path
SITE = Path(__file__).resolve().parent.parent
RUN = Path("/home/azureuser/nav_deliverable_src/runs_ours/nav_easy__easy_adaptive_k2")
H = json.load(open(RUN / "adaptive_history.json")); R = json.load(open(RUN / "ADAPTIVE_RESULT.json"))
def norm(label):  # directory labels zero-pad the round: cand_r001_0_... -> cand_r1_0_...
    return re.sub(r"cand_r0*(\d+)_", lambda m: f"cand_r{int(m.group(1))}_", label)
rows = []
for it in H:
    g = it["genome"]
    label = norm(re.search(r"label='([^']+)'", g).group(1))
    pd = re.search(r"parent_dir=(None|PosixPath\('([^']+)'\))", g)
    parent = None if pd.group(1) == "None" else ("anchor_nav" if pd.group(2).endswith("/harnesses/nav") else norm(Path(pd.group(2)).name))
    score = float(re.search(r"primary=([0-9.]+)", it["fit"]).group(1))
    rows.append({"label": label, "parent": parent, "score": score})
idx = {r["label"]: i for i, r in enumerate(rows)}
best_i = max(range(len(rows)), key=lambda i: (rows[i]["score"], -i)); best_i = next(i for i in range(len(rows)) if rows[i]["score"] == rows[best_i]["score"])
path = set(); i = best_i
while i is not None: path.add(i); i = idx.get(rows[i]["parent"]) if rows[i]["parent"] else None
out = []
for i, r in enumerate(rows):
    out.append({"i": i, "label": r["label"], "p": idx.get(r["parent"]) if r["parent"] else None, "score": r["score"], "path": i in path,
                "best": i == best_i, "depth": None, "diff": None, "nfiles": None, "heading": ""})
L = json.load(open(SITE / "static/data/lineages.json"))
L["nav_easy"] = {"title": "SimWorld-MMNav easy", "primary": "SubtaskSR", "best": rows[best_i]["score"], "best_label": rows[best_i]["label"],
                 "first_at": best_i + 1, "n": len(rows), "n_run": R["cand_evals"], "run": "easy_adaptive_k2", "k0": R["k0"], "C": R["children_per_parent"],
                 "rounds": R["rounds"], "n_cells": R["n_cells"], "n_splits": R["n_splits"], "n_retreats": R["n_retreats"], "rows": out}
json.dump(L, open(SITE / "static/data/lineages.json", "w"), separators=(",", ":"))
print("nav_easy:", len(out), "rows; best", rows[best_i]["label"], rows[best_i]["score"], "at eval", best_i + 1, "| path:", [rows[i]["label"] for i in sorted(path)])
print("meta:", {k: v for k, v in L["nav_easy"].items() if k != "rows"})
