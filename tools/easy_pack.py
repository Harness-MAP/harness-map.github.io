#!/usr/bin/env python3
"""Build the SimWorld-MMNav EASY pack for the page from a run directory: lineage rows, module anatomy of every harness,
and anchor-vs-evolved videos rendered from the evaluator's episode traces (examples/render/render_nav_trace.py).
usage: easy_pack.py RUN_DIR EPISODE [--harness-dir-of LABEL=DIR ...] [--dry-run]
RUN_DIR holds adaptive_history.json (+ ADAPTIVE_RESULT.json); each harness directory is taken from the ledger's
source_dir unless overridden; traces are looked up at <harness or eval dir>/traces/EPISODE."""
import ast, json, math, re, subprocess, sys, argparse
from collections import Counter
from pathlib import Path
sys.path.insert(0, "/home/azureuser/workspace/HarnessMAP"); sys.path.insert(0, "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/pylib_mpl")
from harness_map.qd.descriptors import component_graph, harness_pyfiles, _toplevel, component_role
from display_names import rename_anatomy, file_name, mod_name   # page shows harness.py as orchestrator.py
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); SITE = Path(__file__).resolve().parent.parent; RENDER = Path("/home/azureuser/workspace/HarnessMAP/examples/render/render_nav_trace.py")
ap = argparse.ArgumentParser(); ap.add_argument("run"); ap.add_argument("episode"); ap.add_argument("--harness-dir-of", action="append", default=[]); ap.add_argument("--traces-root", default=""); ap.add_argument("--source-root", default="", help="code at <root>/<label>_r<NNN>/source (anchor = r000)"); ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args(); RUN = Path(a.run); OVR = dict(x.split("=", 1) for x in a.harness_dir_of)
norm = lambda label: re.sub(r"cand_r0*(\d+)_", lambda m: f"cand_r{int(m.group(1))}_", label)
H = json.load(open(RUN / "adaptive_history.json")); RES = json.load(open(RUN / "ADAPTIVE_RESULT.json")) if (RUN / "ADAPTIVE_RESULT.json").exists() else {}
rows = []
for it in H:
    g = it["genome"]; label = norm(re.search(r"label='([^']+)'", g).group(1)); src = re.search(r"source_dir=PosixPath\('([^']+)'\)", g)
    pd = re.search(r"parent_dir=(None|PosixPath\('([^']+)'\))", g)
    parent = None if pd.group(1) == "None" else ("anchor_nav" if pd.group(2).endswith("/harnesses/nav") or "anchor" in Path(pd.group(2)).name else norm(Path(pd.group(2)).name))
    d = Path(OVR.get(label, src.group(1) if src else ""))
    if a.source_root:
        rid = "000" if label.startswith("anchor") else re.match(r"cand_r(\d+)_", label).group(1).zfill(3); d = Path(a.source_root) / f"{label}_r{rid}" / "source"
    rows.append(dict(label=label, parent=parent, score=float(re.search(r"primary=([0-9.]+)", it["fit"]).group(1)), dir=d))
idx = {r["label"]: i for i, r in enumerate(rows)}; best_i = max(range(len(rows)), key=lambda i: (rows[i]["score"], -i)); best_i = next(i for i in range(len(rows)) if rows[i]["score"] == rows[best_i]["score"])
path = set(); i = best_i
while i is not None: path.add(i); i = idx.get(rows[i]["parent"]) if rows[i]["parent"] else None
def py_files(d): return [(rel, p) for rel, p in harness_pyfiles(d)] if d.exists() else []
def diff_vs(d, pd):
    if not (d and pd and d.exists() and pd.exists()): return None
    import difflib
    A = {rel: p.read_text() for rel, p in py_files(pd)}; B = {rel: p.read_text() for rel, p in py_files(d)}; files = ins = dele = 0
    for rel in sorted(set(A) | set(B)):
        if A.get(rel) == B.get(rel): continue
        files += 1
        for ln in difflib.unified_diff(A.get(rel, "").splitlines(), B.get(rel, "").splitlines(), lineterm="", n=0):
            if ln.startswith("+") and not ln.startswith("+++"): ins += 1
            elif ln.startswith("-") and not ln.startswith("---"): dele += 1
    return dict(files=files, insertions=ins, deletions=dele)
def heading(d):
    n = d / "NOTES.md"
    if n.exists():
        for line in n.read_text().splitlines():
            if line.strip() and not line.startswith("##"): return line.lstrip("# ").strip()
    return ""
def anatomy(d):
    nodes, edges = component_graph(d); mods, comp2mod = {}, {}
    for rel, p in py_files(d):
        mod = Path(rel).stem
        if mod == "__init__": continue
        try: t = ast.parse(p.read_text())
        except Exception: continue
        comps = [n.name for n in _toplevel(t)]
        for c in comps: comp2mod[c] = mod
        mods[mod] = dict(name=mod, file=rel, lines=len(p.read_text().splitlines()), components=[[c, component_role(c)] for c in comps])
    if not mods: return None
    main = "harness" if "harness" in mods else max(mods, key=lambda m: len(mods[m]["components"]))
    for m, v in mods.items():
        rc = Counter(r for _, r in v["components"] if r != "logic"); v["role"] = "controller" if m == main else (rc.most_common(1)[0][0] if rc else "tool"); v["main"] = m == main
    me = Counter()
    for x, y in edges:
        mx, my = comp2mod.get(x, x if x in mods else None), comp2mod.get(y, y if y in mods else None)
        if mx and my and mx != my and mx in mods and my in mods: me[(mx, my)] += 1
    entry = None
    for rel, p in py_files(d):
        src = p.read_text(); t = ast.parse(src)
        for n in _toplevel(t):
            cands = [n] if not isinstance(n, ast.ClassDef) else [m for m in n.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]
            for f in cands:
                if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef)) and f.name in ("run_episode", "act", "step", "decide", "build_agent") and (entry is None or Path(rel).stem == "harness"):
                    s = ast.get_source_segment(src, f); lines = s.splitlines(); entry = dict(file=rel, name=(n.name + "." if isinstance(n, ast.ClassDef) else "") + f.name, src="\n".join(lines[:60]) + ("\n…" if len(lines) > 60 else ""), lines=len(lines))
    return rename_anatomy(dict(modules=[mods[m] for m in sorted(mods, key=lambda m: (not mods[m]["main"], m))], edges=[[x, y, n] for (x, y), n in sorted(me.items())], n_components=len(nodes), n_edges=len(edges), entry=entry, heading=heading(d)))
L = json.load(open(SITE / "static/data/lineages.json")); A = json.load(open(SITE / "static/data/anatomy.json")); V = json.load(open(SITE / "static/data/videos.json"))
out_rows, anat = [], []
for i, r in enumerate(rows):
    an = anatomy(r["dir"]) if r["dir"].exists() else None; pd = rows[idx[r["parent"]]]["dir"] if r["parent"] in idx else None
    out_rows.append(dict(i=i, label=r["label"], p=idx.get(r["parent"]) if r["parent"] else None, score=r["score"], path=i in path, best=i == best_i, depth=None, diff=diff_vs(r["dir"], pd), nfiles=len(py_files(r["dir"])) or None, heading=an["heading"] if an else ""))
    anat.append(an); print(f"#{i:2d} {r['label']:32s} {r['score']:.3f} code={'yes' if an else 'NO'} dir={r['dir']}")
if all(anat): A["nav_easy"] = anat
else: print("anatomy incomplete (missing code for", sum(1 for x in anat if not x), "harnesses); anatomy.nav_easy not written")
# ---- videos from traces on the shared episode
vids = []; V_DIR, P_DIR = SITE / "static/videos/nav", SITE / "static/posters/nav"
for i, r in enumerate(rows):
    cands = [Path(a.traces_root) / r["label"] / "traces" / a.episode if a.traces_root else None, r["dir"] / "traces" / a.episode, RUN / "arm_easy_adaptive_k2" / r["label"] / "traces" / a.episode]
    ep = next((c for c in cands if c and c.exists()), None)
    if ep is None: print(f"   no trace of {a.episode} for {r['label']}"); continue
    name = f"nav_easy_{i:02d}"; raw = SITE / "static/videos/nav" / f"{name}.raw.mp4"; dst = V_DIR / f"{name}.mp4"
    if not a.dry_run:
        subprocess.run([sys.executable, str(RENDER), str(ep), str(raw), "--title", f"{r['label']} · {a.episode}", "--fps", "2", "--ffmpeg", FF], check=True)
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(raw), "-c", "copy", "-movflags", "+faststart", str(dst)], check=True); raw.unlink()
        subprocess.run([FF, "-y", "-loglevel", "error", "-ss", "5", "-i", str(dst), "-frames:v", "1", "-q:v", "5", str(P_DIR / f"{name}.jpg")], check=True)
        pr = subprocess.run([FF, "-hide_banner", "-i", str(dst)], capture_output=True, text=True).stderr; m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", pr); m2 = re.search(r", (\d{2,5})x(\d{2,5})", pr)
        dur, w, h = round(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]), 1), int(m2[1]), int(m2[2])
    else: dur = w = h = None
    vd = json.load(open(ep / "verdict.json")); last = json.loads(open(ep / "env_step_log.jsonl").read().strip().splitlines()[-1])
    fd = math.dist(last["agent_location"][:2], last["target_location"][:2])
    vids.append(dict(i=i, label=r["label"], file=f"static/videos/nav/{name}.mp4", poster=f"static/posters/nav/{name}.jpg", episode=a.episode, subtask_sr=vd.get("subtask_sr"), steps=vd.get("steps"), final_dist=round(fd, 1), dur=dur, w=w, h=h, score=r["score"], on_path=i in path, best=i == best_i))
    print(f"   video {name}: {r['label']} subtask_sr {vd.get('subtask_sr')} steps {vd.get('steps')} final_dist {fd/100:.0f} m")
if not a.dry_run:
    L["nav_easy"].update(rows=out_rows, best=rows[best_i]["score"], best_label=rows[best_i]["label"], first_at=best_i + 1, n=len(rows), n_run=RES.get("cand_evals", len(rows)), run=RUN.name)
    if vids: V["nav_easy"] = vids
    json.dump(L, open(SITE / "static/data/lineages.json", "w"), indent=1); json.dump(A, open(SITE / "static/data/anatomy.json", "w"), indent=1); json.dump(V, open(SITE / "static/data/videos.json", "w"), indent=1)
    print("written: lineage rows", len(out_rows), "| anatomy", "yes" if all(anat) else "no", "| videos", len(vids))
