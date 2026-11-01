#!/usr/bin/env python3
"""Case records for Finding 2: within one game, several different evolved harnesses reach 100%.  For each game, pick the
three most mutually dissimilar 100% harnesses of one run (token-set Jaccard over their sources; Maze3D-Pro has one per run,
so its three come from three runs), and record their module graph, largest non-stub function and lineage facts into
static/data/cases.json under same_<game>_<k>."""
import ast, json, re, sys, itertools, glob, os
from collections import Counter
from pathlib import Path
sys.path.insert(0, "/home/azureuser/workspace/HarnessMAP")
from harness_map.qd.descriptors import component_graph, harness_pyfiles, _toplevel, component_role
from display_names import rename_anatomy, file_name, mod_name   # page shows harness.py as orchestrator.py
G = Path("/home/azureuser/workspace/AutoSpatial/spatial_world/game_baselines/runs_adaptive"); SITE = Path(__file__).resolve().parent.parent
NAMES = {"maze3d_pro": "Maze3D-Pro", "block3d": "Block3D", "maze": "Maze", "snake": "Snake", "rubik": "Rubik"}
RUNS = {"maze": ["k32"], "block3d": ["k32"], "snake": ["k32"], "rubik": ["k4"], "maze3d_pro": ["k2", "k16", "k32"]}
SKIP = {"build_agent", "compose_system_prompt", "__init__", "main"}
def history(run):
    out = []
    for x in json.load(open(run / "adaptive_history.json")):
        m = re.match(r"Fitness\(primary=([0-9.]+)", x["fit"]); src = re.search(r"source_dir=PosixPath\('([^']+)'\)", x["genome"])
        out.append(dict(label=x["label"], score=float(m.group(1)) if m else None, dir=Path(src.group(1)) if src else None, parents=x.get("parents") or []))
    return out
def source(d): return "\n".join(p.read_text() for _, p in harness_pyfiles(d))   # the harness's own files only (no stray diagnostics)
def modules_of(d):
    nodes, edges = component_graph(d); mods, comp2mod = {}, {}
    for rel, p in harness_pyfiles(d):
        mod = Path(rel).stem
        if mod == "__init__": continue
        try: t = ast.parse(p.read_text())
        except Exception: continue
        comps = [n.name for n in _toplevel(t)]
        for c in comps: comp2mod[c] = mod
        mods[mod] = dict(name=mod, file=rel, lines=len(p.read_text().splitlines()), components=[[c, component_role(c)] for c in comps])
    main = "harness" if "harness" in mods else max(mods, key=lambda m: len(mods[m]["components"]))
    for m, v in mods.items():
        rc = Counter(r for _, r in v["components"] if r != "logic"); v["role"] = "controller" if m == main else (rc.most_common(1)[0][0] if rc else "tool"); v["main"] = m == main
    me = Counter()
    for a, b in edges:
        ma, mb = comp2mod.get(a, a if a in mods else None), comp2mod.get(b, b if b in mods else None)
        if ma and mb and ma != mb and ma in mods and mb in mods: me[(ma, mb)] += 1
    return [mods[m] for m in sorted(mods, key=lambda m: (not mods[m]["main"], m))], [[a, b, n] for (a, b), n in sorted(me.items())], len(nodes), len(edges)
def core_function(d):
    best = None
    for rel, p in harness_pyfiles(d):
        src = p.read_text()
        try: t = ast.parse(src)
        except Exception: continue
        for n in ast.walk(t):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name not in SKIP and not n.name.startswith("_"):
                span = n.end_lineno - n.lineno + 1
                if best is None or span > best[0]: best = (span, rel, n.name, ast.get_source_segment(src, n))
    span, rel, name, code = best; lines = code.splitlines(); return span, rel, name, "\n".join(lines[:34]) + ("\n…" if len(lines) > 34 else "")
def heading(d):
    notes = d / "NOTES.md"
    if notes.exists():
        for line in notes.read_text().splitlines():
            if line.strip() and not line.startswith("##"): return line.lstrip("# ").strip()
    return ""
C = json.load(open(SITE / "static/data/cases.json")); summary = {}
for g, ks in RUNS.items():
    cands = []
    for k in ks:
        run = G / f"{g}__{k}_claude_pv"; H = history(run); by = {h["label"]: h for h in H}
        for n, h in enumerate(H):
            if h["score"] is not None and h["score"] >= 0.999 and h["dir"] and (h["dir"] / "harness.py").exists():
                par = by.get(H[int(h["parents"][0])]["label"]) if h["parents"] else None
                cands.append(dict(k=k, n=n, label=h["label"], dir=h["dir"], parent=par["label"] if par else None, parent_score=par["score"] if par else None))
    srcs = {c["label"] + c["k"]: set(source(c["dir"]).split()) for c in cands}
    sim = lambda a, b: len(srcs[a["label"] + a["k"]] & srcs[b["label"] + b["k"]]) / len(srcs[a["label"] + a["k"]] | srcs[b["label"] + b["k"]])
    best = min(itertools.combinations(cands, min(3, len(cands))), key=lambda t: max([sim(a, b) for a, b in itertools.combinations(t, 2)] or [0]))
    maxsim = max([sim(a, b) for a, b in itertools.combinations(best, 2)] or [0]); summary[g] = (len(cands), round(maxsim, 3))
    for j, c in enumerate(best):
        mods, edges, ncomp, nedge = modules_of(c["dir"]); span, rel, name, code = core_function(c["dir"])
        C[f"same_{g}_{j}"] = dict(arm=f"{g}__{c['k']}_claude_pv", N=c["n"], label=c["label"], score=1.0, parent=c["parent"], parent_score=c["parent_score"], display=f"{NAMES[g]} · k₀ = {c['k'][1:]}",
                                  pseudo=code, pseudo_src=f"{file_name(rel)} · {name}", code_label=f"Core function · {file_name(rel)} · {name} ({span} lines)", modules=mods, edges=edges, n_components=ncomp, n_edges=nedge, heading=heading(c["dir"]))
        rename_anatomy(C[f"same_{g}_{j}"])
        print(f"{g:10s} {c['k']:4s} #{c['n']:2d} {c['label']:30s} modules {len(mods)} comps {ncomp} core {rel}:{name} | {heading(c['dir'])[:50]}")
    print(f"  -> {g}: {len(cands)} harnesses at 100% in {ks}; chosen trio max pairwise similarity {maxsim:.3f}")
for k in [k for k in C if k.startswith("game_")]: del C[k]   # the single-champion group is superseded
order = ["maze3d_pro", "block3d", "maze", "snake", "rubik"]
C["_same_game"] = dict(text="Within one game, different evolved harnesses reach 100%: three per game, chosen as the most mutually different of one run (Maze3D-Pro's three come from three runs). Pairwise source similarity inside each trio is at most " + ", ".join(f"{summary[g][1]:.2f} ({NAMES[g]})" for g in order) + ".", counts={g: summary[g][0] for g in order}, maxsim={g: summary[g][1] for g in order})
json.dump(C, open(SITE / "static/data/cases.json", "w"), indent=1); print("summary", summary)
