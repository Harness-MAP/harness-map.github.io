#!/usr/bin/env python3
"""Export the structure of the BALROG-MiniHack candidates discussed in the paper's case analysis (§5, §A.9) to
static/data/cases.json: module-level component graph (roles from the release's descriptor rule table), file sizes
and the entry function, read from the archived run directories. The paper's candidate numbers N<k> are 1-based
positions in each arm's evaluation history."""
import ast, json, re, sys
from pathlib import Path
from collections import Counter
HM = Path("/home/azureuser/workspace/HarnessMAP"); sys.path.insert(0, str(HM))
from harness_map.qd.descriptors import component_graph, harness_pyfiles, _toplevel, component_role
SITE = Path(__file__).resolve().parent.parent
LED = json.load(open("/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/balrog_ledgers.json"))
ENTRY = ("act", "step", "run_episode", "build_agent", "decide")

def entry_source(cdir):
    best = None
    for rel, p in harness_pyfiles(cdir):
        src = p.read_text(); t = ast.parse(src)
        for n in _toplevel(t):
            cands = [n] if not isinstance(n, ast.ClassDef) else [m for m in n.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]
            for f in cands:
                if f.name in ENTRY:
                    rank = ENTRY.index(f.name) + (0 if rel.count("/") == 0 else 5)
                    if best is None or rank < best[0]:
                        lines = src.splitlines()[f.lineno - 1: f.end_lineno]; best = (rank, rel, (n.name + "." if isinstance(n, ast.ClassDef) else "") + f.name, lines)
    if not best: return None
    rank, rel, name, lines = best
    ind = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0); lines = [l[ind:] for l in lines]
    body = [l for l in lines if l.strip() and not l.strip().startswith("#")]
    if len(body) > 18: body = body[:16] + ["    ..."]
    return {"file": rel, "name": name, "src": "\n".join(body), "lines": len(lines)}

def anatomy(cdir):
    cdir = Path(cdir); nodes, edges = component_graph(cdir); mods, comp2mod = {}, {}
    for rel, p in harness_pyfiles(cdir):
        mod = Path(rel).stem
        if mod == "__init__": continue
        try: t = ast.parse(p.read_text())
        except Exception: continue
        comps = [n.name for n in _toplevel(t)]
        for c in comps: comp2mod[c] = mod
        mods[mod] = {"file": rel, "lines": len(p.read_text().splitlines()), "components": [[c, component_role(c)] for c in comps]}
    ent = entry_source(cdir)
    main = Path(ent["file"]).stem if ent and Path(ent["file"]).stem in mods else max(mods, key=lambda m: len(mods[m]["components"]))
    for m, v in mods.items():
        rc = Counter(r for _, r in v["components"] if r != "logic")
        v["role"] = "controller" if m == main else (rc.most_common(1)[0][0] if rc else "tool"); v["main"] = m == main
    medges = Counter()
    for a, b in edges:
        ma, mb = comp2mod.get(a, a if a in mods else None), comp2mod.get(b, b if b in mods else None)
        if ma and mb and ma != mb and ma in mods and mb in mods: medges[(ma, mb)] += 1
    return {"modules": [{"name": m, **v} for m, v in sorted(mods.items(), key=lambda kv: (not kv[1]["main"], kv[0]))],
            "edges": [[a, b, n] for (a, b), n in sorted(medges.items())], "n_components": len(nodes), "n_edges": len(edges), "entry": ent}

def by_index(arm, n1):            # paper's N<k>, 1-based
    return LED[arm][n1 - 1]
def by_label(arm, prefix):
    rows = [r for r in LED[arm] if r["label"] and r["label"].startswith(prefix)]; return rows[0] if rows else None
def best_of(arm):
    rows = LED[arm]; b = max(rows, key=lambda r: (r["score"] or 0)); return next(r for r in rows if r["score"] == b["score"])

SPEC = [  # (case id, arm, selector, display name used in the paper)
    ("case1_n03", "adaptive_k4_c1p2", ("idx", 3), "N03"), ("case1_n05", "adaptive_k4_c1p2", ("idx", 5), "N05"),
    ("case1_n15", "adaptive_k4_c1p2", ("idx", 15), "N15"), ("case1_n21", "adaptive_k4_c1p2", ("idx", 21), "N21"),
    ("case1_n39", "adaptive_k4_c1p2", ("idx", 39), "N39"), ("case1_n47", "adaptive_k4_c1p2", ("idx", 47), "N47"),
    ("champ_k2", "adaptive_k2_crn", ("best",), "k₀ = 2 champion"), ("champ_k4", "adaptive_k4_c1p2", ("best",), "k₀ = 4 champion"),
    ("champ_k8", "adaptive_k8_c1p3", ("best",), "k₀ = 8 champion"), ("champ_k16", "adaptive_k16_c1p4", ("best",), "k₀ = 16 champion"),
    ("champ_k32", "adaptive_k32_c1p5", ("best",), "k₀ = 32 champion"),
    ("fail_k32_n44", "adaptive_k32_c1p5", ("idx", 44), "N44"), ("fail_k32_n45", "adaptive_k32_c1p5", ("idx", 45), "N45"), ("fail_k32_n46", "adaptive_k32_c1p5", ("idx", 46), "N46"),
    ("fail_k16_n43", "adaptive_k16_c1p4", ("idx", 43), "N43"),
    ("cell21_r52", "adaptive_k16_c1p4", ("label", "cand_r52_"), "cand_r052"), ("cell23_r64", "adaptive_k16_c1p4", ("label", "cand_r64_"), "cand_r064"),
]
CA = Path("/home/azureuser/workspace/AutoSpatial/balrog/results/case_analysis")
FOLDER = {"case1_n03": "case1_steady_improvement/N03_35pct_cand_r10_0_spatial-grounding", "case1_n05": "case1_steady_improvement/N05_60pct_cand_r11_0_spatial-grounding",
          "case1_n15": "case1_steady_improvement/N15_72pct_cand_r16_0_spatial-grounding", "case1_n21": "case1_steady_improvement/N21_78pct_cand_r19_0_spatial-grounding",
          "case1_n39": "case1_steady_improvement/N39_80pct_cand_r28_0_spatial-grounding", "case1_n47": "case1_steady_improvement/N47_85pct_cand_r32_0_spatial-grounding",
          "champ_k2": "case2_champion_diversity/k02_75pct_VLM", "champ_k4": "case2_champion_diversity/k04_85pct_VLM", "champ_k8": "case2_champion_diversity/k08_82pct_VLM",
          "champ_k16": "case2_champion_diversity/k16_90pct_noVLM", "champ_k32": "case2_champion_diversity/k32_40pct_VLM",
          "fail_k32_n44": "case3_failure/a_stalled_arm_k32_late_N44_20pct", "fail_k32_n45": "case3_failure/a_stalled_arm_k32_late_N45_22pct",
          "fail_k32_n46": "case3_failure/a_stalled_arm_k32_late_N46_30pct", "fail_k16_n43": "case3_failure/b_regression_k16_N43_25pct_from90"}

def pseudocode(cdir, maxlines=26):
    """The entry functions (act, then build_agent) as pseudocode in source order: calls and control flow with their
    real arguments (ast.unparse), docstrings and comments dropped. Calls into the harness's own modules are marked
    «u»…«/u» (structure-bearing)."""
    cdir = Path(cdir); hp = cdir / "harness.py"
    if not hp.exists(): return ""
    tree = ast.parse(hp.read_text(errors="ignore"))
    mods = {Path(rel).stem for rel, _ in harness_pyfiles(cdir)} - {"harness", "__init__"}
    alias = {}
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            for a in n.names:
                stem = a.name.split(".")[-1]
                if stem in mods: alias[a.asname or stem] = stem
        elif isinstance(n, ast.ImportFrom):
            for a in n.names:
                if a.name in mods: alias[a.asname or a.name] = a.name
    names = sorted(alias, key=len, reverse=True)
    pat = re.compile(r"\b(" + "|".join(map(re.escape, names)) + r")\.(\w+)") if names else None
    mark = lambda line: pat.sub(lambda m: f"«u»{m.group(1)}.{m.group(2)}«/u»", line) if pat else line
    out = []
    def block(body, depth):
        """a compound statement's body: the selected lines, or its first statement verbatim when nothing was selected"""
        n0 = len(out); walk(body, depth)
        if len(out) == n0 and len(out) < maxlines and body: out.append("    " * depth + ast.unparse(body[0]).split("\n")[0])
    def walk(body, depth):
        for st in body:
            if len(out) >= maxlines: return
            pad = "    " * depth
            if isinstance(st, ast.Expr) and isinstance(getattr(st, "value", None), ast.Constant) and isinstance(st.value.value, str): continue
            if isinstance(st, ast.If):
                out.append(f"{pad}if {ast.unparse(st.test)}:"); block(st.body, depth + 1)
                if st.orelse:
                    if len(st.orelse) == 1 and isinstance(st.orelse[0], ast.If): walk([st.orelse[0]], depth)   # elif chain
                    else: out.append(f"{pad}else:"); block(st.orelse, depth + 1)
            elif isinstance(st, ast.For): out.append(f"{pad}for {ast.unparse(st.target)} in {ast.unparse(st.iter)}:"); block(st.body, depth + 1)
            elif isinstance(st, ast.While): out.append(f"{pad}while {ast.unparse(st.test)}:"); block(st.body, depth + 1)
            elif isinstance(st, ast.With): out.append(f"{pad}with {', '.join(ast.unparse(i) for i in st.items)}:"); block(st.body, depth + 1)
            elif isinstance(st, ast.Try):
                out.append(f"{pad}try:"); block(st.body, depth + 1)
                for h in st.handlers: out.append(f"{pad}except {ast.unparse(h.type) if h.type else ''}:".replace(' :', ':')); block(h.body, depth + 1)
            elif isinstance(st, ast.Return): out.append(f"{pad}return {ast.unparse(st.value) if st.value else ''}".rstrip())
            elif isinstance(st, (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr)):
                if not any(isinstance(c, ast.Call) for c in ast.walk(st)): continue
                out.append(pad + ast.unparse(st))
            elif isinstance(st, (ast.Break, ast.Continue)): out.append(pad + ("break" if isinstance(st, ast.Break) else "continue"))
    fns = []
    for n in tree.body:
        if isinstance(n, ast.ClassDef):
            for m in n.body:
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)) and m.name == "act": fns.append(m)
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == "build_agent": fns.append(n)
    fns.sort(key=lambda f: 0 if f.name == "act" else 1)
    for fn in fns:
        if len(out) >= maxlines: break
        out.append(f"def {fn.name}({', '.join(a.arg for a in fn.args.args)}):"); walk(fn.body, 1); out.append("")
    while out and out[-1] == "": out.pop()
    if len(out) >= maxlines: out.append("    ...")
    return "\n".join(mark(l) for l in out)

out = {}
for cid, arm, sel, disp in SPEC:
    r = by_index(arm, sel[1]) if sel[0] == "idx" else best_of(arm) if sel[0] == "best" else by_label(arm, sel[1])
    if not r: print("MISSING", cid); continue
    parent = next((p for p in LED[arm] if p["label"] and r["parent"] and re.sub(r"cand_r0*(\d+)_", r"cand_r\1_", p["label"]) == re.sub(r"cand_r0*(\d+)_", r"cand_r\1_", r["parent"])), None)
    a = anatomy(r["src"])
    src = CA / FOLDER[cid] if cid in FOLDER and (CA / FOLDER[cid]).exists() else Path(r["src"])
    out[cid] = {"arm": arm, "N": r["i"] + 1, "label": r["label"], "score": r["score"], "parent": r["parent"], "parent_score": parent["score"] if parent else None, "display": disp,
                "pseudo": pseudocode(src), "pseudo_src": str(src.relative_to(CA)) if src.is_relative_to(CA) else "run dir", **a}
    print(f"{cid:14s} {arm:18s} N{r['i']+1:02d} {r['label']:34s} {r['score']}  parent={r['parent']} ({out[cid]['parent_score']})  modules={[m['name'] for m in a['modules']]}")
p = SITE / "static/data/cases.json"; p.write_text(json.dumps(out, separators=(",", ":"))); print("wrote", p, p.stat().st_size, "bytes")
