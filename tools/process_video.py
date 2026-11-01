#!/usr/bin/env python3
"""Render the whole Harness-MAP process on one real run as a video: factorize a harness into its component graph and
token blocks, locate it on the Voronoi map, evolve the archive step by step (children, sub-splits, reversions, new
elites) and finally lift every harness by its success.  Data: static/data/trajectory.json (tools/trajectory.py) and the
run's candidate directories for the component graphs.  Writes static/video/harness_map_process.mp4 and its poster."""
import json, math, sys, os
from pathlib import Path
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, FancyArrowPatch
from matplotlib import animation
SITE = Path(__file__).resolve().parent.parent
D = json.load(open(SITE / "static/data/trajectory.json"))
N, C, STEPS = D["nodes"], D["cells"], D["steps"]; PATH = set(D["path"]); BEST = D["best"]
RAMP = ['#3c9bc9', '#65bdba', '#b0d6a9', '#fee199', '#fdcd94', '#faa26f', '#f97f5f', '#fc757b']
ramp = lambda f: RAMP[max(0, min(7, int(f * 8)))]
INK, INK2, MUTED, LINE, LINE2, SURF, BG, ACC, WARM = '#16243b', '#334155', '#5b6b82', '#dfe6ee', '#b8c4d2', '#ffffff', '#f7f8fa', '#3c9bc9', '#fc757b'
OCC = '#e6f1f8'
ROLE = {'orchestrator': '#3c9bc9', 'controller': '#65bdba', 'capture': '#b0d6a9', 'perception': '#fee199', 'policy': '#faa26f', 'solver': '#fc757b', 'logic': '#b8c4d2', 'tool': '#fdcd94', 'other': '#cfd8e3'}
# ---------------------------------------------------------------- component graphs of the anchor and the best harness (release descriptor code)
sys.path.insert(0, "/home/azureuser/workspace/HarnessMAP")
import ast
from collections import Counter
from harness_map.qd.descriptors import component_graph, harness_pyfiles, _toplevel, component_role
from display_names import rename_anatomy, file_name, mod_name   # page shows harness.py as orchestrator.py
RUN = Path("/home/azureuser/workspace/AutoSpatial/balrog/balrog_ours/runs") / D["run"] / "candidates"
def graph_of(cdir):
    """Module-level graph: one node per .py file with its components and dominant role; inter-module call/import edges."""
    cdir = Path(cdir); nodes, edges = component_graph(cdir); mods, comp2mod = {}, {}
    for rel, pth in harness_pyfiles(cdir):
        mod = Path(rel).stem
        if mod == "__init__": continue
        try: t = ast.parse(pth.read_text())
        except Exception: continue
        comps = [n.name for n in _toplevel(t)]
        for c in comps: comp2mod[c] = mod
        mods[mod] = dict(name=mod_name(mod), comps=[(c, component_role(c)) for c in comps])
    main = max(mods, key=lambda m: len(mods[m]["comps"]))
    for m, v in mods.items():
        rc = Counter(r for _, r in v["comps"] if r != "logic"); v["role"] = "controller" if m == main else (rc.most_common(1)[0][0] if rc else "tool"); v["main"] = m == main
    me = Counter()
    for x, y in edges:
        mx, my = comp2mod.get(x, x if x in mods else None), comp2mod.get(y, y if y in mods else None)
        if mx and my and mx != my and mx in mods and my in mods: me[(mx, my)] += 1
    order = sorted(mods, key=lambda m: (not mods[m]["main"], m))
    return dict(mods=[mods[m] for m in order], edges=[(mod_name(x), mod_name(y), n) for (x, y), n in me.items()], n_comp=len(nodes), n_edges=len(edges))
import re as _re
_R = json.load(open(RUN.parent / "RESULT.json"))
_SRC = {h["label"]: Path(_re.search(r"source_dir=PosixPath\('([^']+)'\)", h["genome"]).group(1)) for h in _R["history"]}
def find_dir(label):
    """The candidate directory recorded in the run's history (folder names are zero-padded, labels are not)."""
    d = _SRC[label]
    if not d.exists(): raise FileNotFoundError(d)
    return d
G_ANCHOR = graph_of(find_dir(N[0]["label"])); G_BEST = graph_of(find_dir(N[BEST]["label"]))
print("anchor graph:", len(G_ANCHOR["mods"]), "modules", G_ANCHOR["n_comp"], "components | best graph:", len(G_BEST["mods"]), "modules", G_BEST["n_comp"], "components")

# ---------------------------------------------------------------- geometry helpers (shared with the page's panel)
bx0 = min(p[0] for c in C.values() for p in c["poly"]); bx1 = max(p[0] for c in C.values() for p in c["poly"])
by0 = min(p[1] for c in C.values() for p in c["poly"]); by1 = max(p[1] for c in C.values() for p in c["poly"]); BW = bx1 - bx0; BH = by1 - by0
def proj(p, h, s):
    """s = 0 flat map, s = 1 the 3D lift (rotated, foreshortened floor; success as height)."""
    u, v = (p[0] - bx0) / BW, (p[1] - by0) / BW; th = s * math.radians(34); tilt = 1 - 0.54 * s; hz = 0.42 * s
    return (u * math.cos(th) - v * math.sin(th), (u * math.sin(th) + v * math.cos(th)) * tilt - h * hz)
def frame_bounds(s):
    pts = [proj(p, h, s) for p in ((bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)) for h in (0, 1)]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]; return min(xs), max(xs), min(ys), max(ys)

W, H, FPS = 1280, 720, 30
fig = plt.figure(figsize=(W / 100, H / 100), dpi=100); fig.patch.set_facecolor(BG)
def clear():
    fig.clf(); fig.patch.set_facecolor(BG)
def header(stage, title, sub=""):
    fig.text(0.04, 0.945, stage, fontsize=11, color=ACC, family="monospace", weight="bold")
    fig.text(0.04, 0.895, title, fontsize=20, color=INK, weight="bold")
    if sub: fig.text(0.04, 0.855, sub, fontsize=11.5, color=MUTED)
    fig.text(0.96, 0.945, f"Harness-MAP · {D['bench']} · k₀ = {D['k0']}", fontsize=10, color=MUTED, ha="right", family="monospace")

def draw_graph(ax, G, title, reveal=1.0, highlight_new=None):
    mods = G["mods"]; n = len(mods); ax.set_axis_off(); ax.set_xlim(-1.45, 1.45); ax.set_ylim(-1.35, 1.35); ax.set_aspect("equal")
    ax.set_title(title, fontsize=11, color=INK2, loc="left")
    ring = [m for m in mods if not m["main"]]; pos = {m["name"]: (0.0, 0.05) for m in mods if m["main"]}
    for k, m in enumerate(ring): ang = 2 * math.pi * k / max(1, len(ring)) + math.pi / 2; pos[m["name"]] = (math.cos(ang), math.sin(ang))
    shown = [m["name"] for m in mods[:max(1, int(math.ceil(reveal * n)))]]
    for x, y, w in G["edges"]:
        if x in shown and y in shown: ax.annotate("", xy=pos[y], xytext=pos[x], arrowprops=dict(arrowstyle="-|>", color=LINE2, lw=0.8 + 0.4 * min(w, 4), shrinkA=16, shrinkB=16))
    for m in mods:
        if m["name"] not in shown: continue
        new = highlight_new and m["name"] in highlight_new; r = 0.09 + 0.035 * math.sqrt(len(m["comps"])); p = pos[m["name"]]
        ax.add_patch(Circle(p, r, facecolor=ROLE.get(m["role"], ROLE["other"]), edgecolor=WARM if new else INK, lw=2.4 if new else 1.2, zorder=3))
        ax.text(p[0], p[1] - r - 0.05, f"{m['name'][:18]}\n{len(m['comps'])} comp.", fontsize=7.5 if n > 8 else 8.5, ha="center", va="top", color=WARM if new else INK2, family="monospace", zorder=4)
def draw_descriptor_bars(ax, G, reveal_s, reveal_t):
    ax.set_axis_off(); ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.text(0, 0.97, "φ(H) = ( φ_S(s) ;  φ_T(θ) )", fontsize=13, color=INK, weight="bold", va="top")
    counts = Counter(r for m in G["mods"] for _, r in m["comps"]); tot = max(1, sum(counts.values())); keys = [k for k, _ in counts.most_common(7)]
    ax.text(0, 0.84, "structural descriptor φ_S · role-aware WL pattern histogram (t = 0: role proportions)", fontsize=9.5, color=ACC, va="top")
    for k, key in enumerate(keys):
        w = counts[key] / tot * reveal_s; y = 0.76 - k * 0.06
        ax.add_patch(plt.Rectangle((0.3, y), 0.6 * w, 0.04, color=ROLE.get(key, ROLE["other"])))
        ax.text(0.28, y + 0.02, key, fontsize=8.5, ha="right", va="center", color=INK2, family="monospace")
        ax.text(0.31 + 0.6 * w, y + 0.02, f"{counts[key] / tot:.2f}", fontsize=8, va="center", color=MUTED, family="monospace")
    y0 = 0.76 - len(keys) * 0.06 - 0.06
    ax.text(0, y0, "token-level descriptor φ_T · z-scored blocks rescaled by √d", fontsize=9.5, color=WARM, va="top")
    for k, (blk, val) in enumerate([("f_AST", 0.72), ("f_num", 0.38), ("f_doc", 0.55)]):
        y = y0 - 0.08 - k * 0.06
        ax.add_patch(plt.Rectangle((0.3, y), 0.6 * val * reveal_t, 0.04, color=["#fc757b", "#faa26f", "#fdcd94"][k]))
        ax.text(0.28, y + 0.02, blk, fontsize=8.5, ha="right", va="center", color=INK2, family="monospace")
def draw_map(ax, t, s3=0.0, show_members=None, pulse=None, arrow=None, new_best=None, hide_kids=False, lineage=True, dim_future=False):
    """The archive at step t, projected with lift s3; `show_members` optionally restricts which harnesses are drawn."""
    step = STEPS[t]; ax.set_axis_off(); ax.set_aspect("equal")
    x0, x1, y0, y1 = frame_bounds(s3); pad = 0.05 * (x1 - x0); ax.set_xlim(x0 - pad, x1 + pad); ax.set_ylim(y1 + pad, y0 - pad)   # y down, like the page
    ev = step["event"] or {}; born = set(ev.get("children", []) if ev.get("kind") == "split" else (ev.get("also_split", {}) or {}).get("children", [])); merged = [c for sub in ev.get("merged", []) for c in sub] if ev.get("kind") == "retreat" else []
    cellOf = {i: int(cid) for cid, ms in step["members"].items() for i in ms}
    for cid in step["cells"]:
        c = C[str(cid)]; occ = len(step["members"].get(str(cid), [])) > 0; new = cid in born
        pts = [proj(p, 0, s3) for p in c["poly"]]
        ax.add_patch(Polygon(pts, closed=True, facecolor=OCC if occ else SURF, edgecolor=ACC if new else (LINE2 if occ else LINE), lw=2 if new else 1, ls="--" if (new or not occ) else "-", zorder=1))
        vt = min(c["poly"], key=lambda q: q[1]); lab = (c["c"][0] + 0.62 * (vt[0] - c["c"][0]), c["c"][1] + 0.62 * (vt[1] - c["c"][1]))
        q = proj(lab, 0, s3); ax.text(q[0], q[1], ("↳ " if c["depth"] else "") + f"cell {cid}", fontsize=8.5, ha="center", va="top", color=ACC if new else MUTED, weight="bold" if new else "normal", family="monospace", zorder=2)
    for cid in merged:
        c = C.get(str(cid))
        if c: ax.add_patch(Polygon([proj(p, 0, s3) for p in c["poly"]], closed=True, fill=False, edgecolor=WARM, lw=1.2, ls="--", zorder=2))
    if ev.get("kind") == "retreat":
        for pc in ev["parents"]:
            q = proj(C[str(pc)]["c"], 0, s3); ax.text(q[0], q[1] + 0.03, "↺ split reverted", fontsize=8, ha="center", color=WARM, weight="bold", zorder=4)
    pos = {int(i): proj(p, N[int(i)]["fit"] * (s3 > 0), s3) for i, p in step["pos"].items()}; floor = {int(i): proj(p, 0, s3) for i, p in step["pos"].items()}
    ids = sorted(pos, key=lambda i: floor[i][1]) if s3 > 0 else sorted(pos)
    if show_members is not None: ids = [i for i in ids if i in show_members]
    if hide_kids: ids = [i for i in ids if i not in step["kids"]]
    if s3 > 0:
        for i in ids: ax.plot([floor[i][0], pos[i][0]], [floor[i][1], pos[i][1]], color=WARM if i in PATH else LINE2, lw=1.4 if i in PATH else 0.9, zorder=3)
    if lineage:
        path = [i for i in D["path"] if i in pos and i in ids]
        for a, b in zip(path, path[1:]): ax.annotate("", xy=pos[b], xytext=pos[a], arrowprops=dict(arrowstyle="-|>", color=WARM, lw=2.2, shrinkA=7, shrinkB=7), zorder=5)
    if arrow and arrow[0] in pos and arrow[1] in pos: ax.annotate("", xy=pos[arrow[1]], xytext=pos[arrow[0]], arrowprops=dict(arrowstyle="-|>", color=INK2, lw=1.3, shrinkA=7, shrinkB=7), zorder=5)
    for i in ids:
        n = N[i]; p = pos[i]; elite = step["elites"].get(str(cellOf.get(i)), None) == i
        if elite: ax.add_patch(Circle(p, 0.0105, fill=False, edgecolor=WARM if i == BEST else INK, lw=2 if i == BEST else 1.2, zorder=6))
        if i in step["kids"] and not hide_kids: ax.add_patch(Circle(p, 0.0135, fill=False, edgecolor=INK, lw=1, ls="--", zorder=6))
        if pulse == i: ax.add_patch(Circle(p, 0.02, fill=False, edgecolor=ACC, lw=2.2, zorder=6))
        if new_best == i: ax.add_patch(Circle(p, 0.026, fill=False, edgecolor=WARM, lw=2.5, zorder=6))
        ax.add_patch(Circle(p, 0.0065, facecolor=ramp(n["fit"]), edgecolor=SURF, lw=1, zorder=7))
        if i in PATH or i in step["kids"] or i == 0: ax.text(p[0], p[1] + 0.02, n["short"], fontsize=8.5 if i not in PATH else 9.5, ha="center", va="top", color=WARM if i in PATH else INK2, weight="bold" if i in PATH else "normal", family="monospace", zorder=8)
    if s3 > 0:   # height axis
        b, tp = proj((bx0, by1), 0, s3), proj((bx0, by1), 1, s3); ax.plot([b[0], tp[0]], [b[1], tp[1]], color=LINE2, lw=1)
        for h in (0, .5, 1): q = proj((bx0, by1), h, s3); ax.text(q[0] - 0.01, q[1], f"{h:.1f}", fontsize=7.5, ha="right", va="center", color=MUTED)
        ax.text(tp[0] - 0.01, tp[1] - 0.03, "success", fontsize=8, ha="right", color=MUTED)
def side_stats(t, extra=""):
    step = STEPS[t]; b = N[step["best"]]
    for k, (v, lab) in enumerate([(f"T = {t}", "step"), (step["evals"], "evaluations"), (f"{step['occupied']} / {step['n_cells']}", "cells occupied"), (f"{b['fit']:.3f}", "best so far")]):
        fig.text(0.56 + (k % 2) * 0.19, 0.78 - (k // 2) * 0.1, str(v), fontsize=17, color=ACC, weight="bold", family="monospace")
        fig.text(0.56 + (k % 2) * 0.19, 0.75 - (k // 2) * 0.1, lab, fontsize=9, color=MUTED)
    if extra: fig.text(0.56, 0.56, extra, fontsize=10.5, color=INK2, va="top", wrap=True, linespacing=1.5)
def legend():
    fig.text(0.56, 0.17, "● success, low → high", fontsize=9, color=MUTED); 
    for k, c in enumerate(RAMP): fig.patches.append(plt.Rectangle((0.56 + k * 0.012, 0.13), 0.012, 0.018, transform=fig.transFigure, color=c))
    fig.text(0.56, 0.10, "○ cell elite   ◌ this step's child   ━ lineage of the best", fontsize=9, color=MUTED)

# ---------------------------------------------------------------- the timeline
SCENE = []   # (duration seconds, render(fn of local time u in [0,1]))
def scene_factorize(u):
    clear(); header("1 · FACTORIZE", "A harness is a structure and a token-level implementation", "H = (s, θ): the component graph with its call and import edges, and the code inside the components")
    axg = fig.add_axes([0.04, 0.06, 0.44, 0.7]); draw_graph(axg, G_ANCHOR, "component graph s of the reference harness", reveal=min(1, u * 1.6))
    axb = fig.add_axes([0.54, 0.06, 0.42, 0.7]); draw_descriptor_bars(axb, G_ANCHOR, reveal_s=max(0, min(1, (u - 0.35) / 0.3)), reveal_t=max(0, min(1, (u - 0.65) / 0.3)))
SCENE.append((7.0, scene_factorize))
def scene_locate(u):
    clear(); header("2 · LOCATE", "Coordinates place every harness in a cell of the map", f"{D['k0']} Voronoi cells fitted by k-means over sampled descriptors · a harness belongs to its nearest centroid · zero evaluations")
    ax = fig.add_axes([0.03, 0.05, 0.47, 0.82]); founders = STEPS[0]["kids"]; k = min(len(founders), int(u * (len(founders) + 1)))
    draw_map(ax, 0, show_members=set(founders[:k]), pulse=founders[k - 1] if k else None, lineage=False)
    txt = "the reference harness lands in its cell" if k <= 1 else f"coverage-gated initialization: founders until ⌈m·k₀⌉ = {D['M']} cells are occupied\n({k} of {D['k0']} cells occupied)"
    fig.text(0.56, 0.78, txt, fontsize=11, color=INK2, va="top", linespacing=1.5); legend()
SCENE.append((6.0, scene_locate))
STEP_SEC = 0.8
def scene_evolve(u):
    tot = (len(STEPS) - 1) * STEP_SEC; tt = u * tot; t = min(len(STEPS) - 1, 1 + int(tt / STEP_SEC)); frac = (tt - (t - 1) * STEP_SEC) / STEP_SEC
    step = STEPS[t]; kid = step["kids"][0] if step["kids"] else None; par = N[kid]["parent"] if kid is not None else None
    prev = STEPS[t - 1]; improved = N[step["best"]]["fit"] > N[prev["best"]]["fit"] + 1e-9
    ev = step["event"] or {}
    clear(); header("3 · EVOLVE", "Select an elite · diagnose · steer a child · evaluate · archive · adapt", "one parent and one child per step · the map sub-splits the cell with the largest fitness range and reverts splits that do not pay")
    ax = fig.add_axes([0.03, 0.05, 0.47, 0.82])
    if frac < 0.35: draw_map(ax, t - 1, pulse=par, lineage=True)                      # the parent elite is selected
    elif frac < 0.6: draw_map(ax, t, hide_kids=False, arrow=(par, kid) if par is not None else None, lineage=True)   # the child lands
    else: draw_map(ax, t, new_best=step["best"] if improved else None, lineage=True)
    what = ""
    if kid is not None: what = f"child {N[kid]['short']} bred from {N[par]['short'] if par is not None else 'the reference'}" + (f", aimed at cell {N[kid]['steer']}" if N[kid]['steer'] is not None else "") + f"\n→ placed in cell {N[kid]['cell']}, success {N[kid]['fit']:.3f}"
    if ev.get("kind") == "split": what += f"\n\nsub-split: cell {ev['cell']} → cells {ev['children'][0]} and {ev['children'][1]}"
    if ev.get("kind") == "retreat": what += "\n\nreverted: " + "; ".join(f"cells {', '.join(map(str, m))} merge back into cell {p}" for p, m in zip(ev["parents"], ev["merged"]))
    if improved and frac >= 0.6: what += f"\n\nnew best so far: {N[step['best']]['fit']:.3f}"
    side_stats(t if frac >= 0.35 else t - 1, what); legend()
SCENE.append(((len(STEPS) - 1) * STEP_SEC, scene_evolve))
def scene_illuminate(u):
    clear(); header("4 · ILLUMINATE", "An archive of diverse harnesses, and the lineage that crossed the map", f"{N[0]['fit']:.3f} → {N[BEST]['fit']:.3f} success in {N[BEST]['n']} evaluations · best lineage " + " → ".join(N[i]["short"] for i in D["path"]))
    s3 = max(0, min(1, (u - 0.25) / 0.45)); s3 = s3 * s3 * (3 - 2 * s3)
    ax = fig.add_axes([0.03, 0.05, 0.47, 0.82]); draw_map(ax, len(STEPS) - 1, s3=s3, lineage=True); side_stats(len(STEPS) - 1, "every harness lifted to its success\nelites ringed, the best in warm" if s3 > 0.05 else ""); legend()
SCENE.append((8.0, scene_illuminate))
def scene_graphs(u):
    clear(); header("4 · ILLUMINATE", "What changed between the reference and the best harness", "modules in warm outline are new · node size = number of components · the structural descriptor moved the harness across cells")
    newc = set(m["name"] for m in G_BEST["mods"]) - set(m["name"] for m in G_ANCHOR["mods"])
    draw_graph(fig.add_axes([0.03, 0.05, 0.46, 0.72]), G_ANCHOR, f"reference harness · {len(G_ANCHOR['mods'])} modules, {G_ANCHOR['n_comp']} components · success {N[0]['fit']:.3f}")
    draw_graph(fig.add_axes([0.51, 0.05, 0.46, 0.72]), G_BEST, f"best harness {N[BEST]['short']} · {len(G_BEST['mods'])} modules, {G_BEST['n_comp']} components · success {N[BEST]['fit']:.3f}", highlight_new=newc)
SCENE.append((6.0, scene_graphs))
TOTAL = sum(s[0] for s in SCENE); frames = int(TOTAL * FPS); print("scenes", len(SCENE), "total s", TOTAL, "frames", frames)
def render(k):
    tsec = k / FPS; acc = 0
    for dur, fn in SCENE:
        if tsec < acc + dur or (dur, fn) is SCENE[-1]: fn(min(1, (tsec - acc) / dur)); return
        acc += dur
ff = os.environ.get("FFMPEG") or "ffmpeg"; matplotlib.rcParams["animation.ffmpeg_path"] = ff
out = SITE / "static/video/harness_map_process.mp4"
render(int(28 * FPS)); fig.savefig(SITE / "static/video/harness_map_process.jpg", dpi=100, facecolor=BG)
if os.environ.get("POSTER_ONLY"): print("poster only"); sys.exit(0)
if os.environ.get("FRAMES_AT"):
    for sec in os.environ["FRAMES_AT"].split(","): render(int(float(sec) * FPS)); fig.savefig(f"/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/vframes/new_{sec}.png", dpi=100, facecolor=BG)
    print("frames written"); sys.exit(0)
writer = animation.FFMpegWriter(fps=FPS, codec="libx264", bitrate=2600, extra_args=["-pix_fmt", "yuv420p", "-movflags", "+faststart", "-preset", "medium", "-crf", "23"])
with writer.saving(fig, str(out), dpi=100):
    for k in range(frames):
        render(k); writer.grab_frame()
        if k % 300 == 0: print("frame", k, "/", frames, flush=True)
print("wrote", out, out.stat().st_size // 1024, "KB")
