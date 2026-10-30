#!/usr/bin/env python3
"""Export the structure of every harness in the evolution packs to static/data/anatomy.json.

For each harness directory the release's own descriptor code gives the component graph and the
role of every top-level component (harness_map.qd.descriptors); this script aggregates that to the
module level (one node per .py file, its role mix, its components), keeps the inter-module call and
import edges, and adds the entry function's source as the code excerpt plus the proposer's NOTES
heading and the file listing with line counts."""
import ast, json, re, sys
from pathlib import Path
from collections import Counter
HM = Path("/home/azureuser/workspace/HarnessMAP"); sys.path.insert(0, str(HM))
from harness_map.qd.descriptors import component_graph, roles, harness_pyfiles, _toplevel, component_role
E = HM / "examples"; SITE = Path(__file__).resolve().parent.parent
PACKS = {"balrog": E / "balrog/evolution", "nav_hard": E / "simworld_nav/evolution",
         **{f"games_{g}": E / f"spatialworld_games/evolution/{g}" for g in ["maze3d_pro", "block3d", "maze", "snake", "rubik"]}}
ENTRY = ("act", "step", "run_episode", "build_agent", "decide")

def entry_source(cdir):
    """Source of the entry function (preferring act/step/run_episode in the main module), trimmed."""
    best = None
    for rel, p in harness_pyfiles(cdir):
        src = p.read_text(); t = ast.parse(src)
        for n in _toplevel(t):
            cands = [n] if not isinstance(n, ast.ClassDef) else [m for m in n.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]
            for f in cands:
                if f.name in ENTRY:
                    rank = ENTRY.index(f.name) + (0 if rel.count("/") == 0 else 5)
                    if best is None or rank < best[0]:
                        lines = src.splitlines()[f.lineno - 1: f.end_lineno]
                        best = (rank, rel, (n.name + "." if isinstance(n, ast.ClassDef) else "") + f.name, lines)
    if not best: return None
    rank, rel, name, lines = best
    ind = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
    lines = [l[ind:] for l in lines]
    body = [l for l in lines if l.strip() and not l.strip().startswith("#")]
    if len(body) > 22: body = body[:20] + ["    ..."]
    return {"file": rel, "name": name, "src": "\n".join(body), "lines": len(lines)}

def anatomy(cdir):
    cdir = Path(cdir)
    nodes, edges = component_graph(cdir); rl = roles(cdir)
    mods, comp2mod = {}, {}
    for rel, p in harness_pyfiles(cdir):
        mod = Path(rel).stem
        if mod == "__init__": continue
        try: t = ast.parse(p.read_text())
        except Exception: continue
        comps = [n.name for n in _toplevel(t)]
        for c in comps: comp2mod[c] = mod
        mods[mod] = {"file": rel, "lines": len(p.read_text().splitlines()), "components": [[c, component_role(c)] for c in comps]}
    if not mods: return None
    ent = entry_source(cdir)
    main = Path(ent["file"]).stem if ent and Path(ent["file"]).stem in mods else max(mods, key=lambda m: len(mods[m]["components"]))
    for m, v in mods.items():
        rc = Counter(r for _, r in v["components"] if r != "logic")
        v["role"] = "controller" if m == main else (rc.most_common(1)[0][0] if rc else "tool")
        v["main"] = m == main
    medges = Counter()
    for a, b in edges:
        ma, mb = comp2mod.get(a, a if a in mods else None), comp2mod.get(b, b if b in mods else None)
        if ma and mb and ma != mb and ma in mods and mb in mods: medges[(ma, mb)] += 1
    notes = cdir / "NOTES.md"; heading = ""
    if notes.exists():
        for line in notes.read_text().splitlines():
            if line.strip() and not line.startswith("##"): heading = line.lstrip("# ").strip(); break
    return {"modules": [{"name": m, **v} for m, v in sorted(mods.items(), key=lambda kv: (not kv[1]["main"], kv[0]))],
            "edges": [[a, b, n] for (a, b), n in sorted(medges.items())], "n_components": len(nodes), "n_edges": len(edges),
            "entry": ent, "heading": heading[:160]}

out = {}
for key, pack in PACKS.items():
    lin = json.load(open(pack / "lineage.json"))
    rows = []
    for h in lin["harnesses"]:
        a = anatomy(pack / h["dir"]); rows.append(a)
    out[key] = rows
    sizes = [(len(a["modules"]), a["n_components"], a["n_edges"]) for a in rows if a]
    print(key, len(rows), "harnesses; modules/components/edges per harness:", sizes[:6], "...", sizes[-1])
p = SITE / "static/data/anatomy.json"; p.write_text(json.dumps(out, separators=(",", ":")))
print("wrote", p, p.stat().st_size, "bytes")
print(json.dumps(out["balrog"][40], indent=1)[:2500])
