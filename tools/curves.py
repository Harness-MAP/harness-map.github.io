import json, collections
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from pathlib import Path
A = Path("/home/azureuser/workspace/AutoSpatial"); OUT = Path("/home/azureuser/workspace/harness-evolution.github.io/static/img")
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.edgecolor": "#8a8a8a", "axes.linewidth": 0.8, "xtick.color": "#444", "ytick.color": "#444",
                     "axes.labelcolor": "#222", "grid.color": "#e6e6e6", "grid.linewidth": 0.6, "legend.fontsize": 8})
BLUES = {2: "#86b6ef", 4: "#5598e7", 8: "#2a78d6", 16: "#1c5cab", 32: "#0d366b"}
BASE = {"Meta-Harness": "#eb6834", "DGM": "#1baf7a", "ShinkaEvolve": "#6250d6", "GEPA": "#e87ba4", "OpenEvolve": "#eda100"}
GAMES_METHOD = {"iris": "Meta-Harness", "dgm": "DGM", "shinka": "ShinkaEvolve", "gepa": "GEPA", "openevolve": "OpenEvolve"}
MODE_NAME = {"adaptive": "adaptive", "fixed": "fixed", "hier": "hier"}

def bsf(points, key):
    cur, out = 0.0, {}
    for x, y in sorted(points): cur = max(cur, y); out[x] = cur
    return out
def at(curve, x):
    ks = [k for k in curve if k <= x]; return curve[max(ks)] if ks else 0.0

# ------------- games: plain mean over the 5 games (the paper's Table 1/8 convention)
G = json.load(open(A/"spatial_world/figures/figs_3dgames_codex/score_log_tableA_gpt.json"))["arms"]
def games_curves(method, mode=None, k0=None, axis="n"):
    arms = [a for a in G if a["method"] == method and (mode is None or a["mode"] == mode) and (k0 is None or a["k0"] == k0)]
    curves = {}
    for a in arms:
        if not a["trajectory"]: continue
        curves[a["game"]] = bsf([(r[axis], r["best_so_far"]) for r in a["trajectory"]], axis)
    if not curves: return [], [], 0
    xmax = max(max(c) for c in curves.values()); xmax = min(xmax, 50) if axis == "n" else xmax
    xs = list(range(0 if axis == "t" else 1, xmax + 1))
    ys = [100 * sum(at(c, x) for c in curves.values()) / len(curves) for x in xs]
    return xs, ys, len(curves)
QWEN_GAMES = 100 * (0.45 + 0.0 + 0.05 + 0.0 + 0.063) / 5

# ------------- balrog: 'ALL' task, canonical arms
B = [r for r in json.load(open(A/"balrog/figures/score_log_balrog.json")) if r["task"] == "ALL" and r["canonical"]]
def balrog_curve(method, mode=None, k0=None, axis="n"):
    rows = [r for r in B if r["method"] == method and (mode is None or r["mode"] == mode) and (k0 is None or r["k0"] == k0)]
    if not rows: return [], []
    c = bsf([(r[axis], r["best_so_far"]) for r in rows], axis)
    xmax = min(max(c), 50) if axis == "n" else max(c)
    xs = list(range(0 if axis == "t" else 1, xmax + 1)); return xs, [100 * at(c, x) for x in xs]
anchor = json.load(open(A/"balrog/figures/series.json"))["anchor"]

def label_endpoints(ax, ends, gap_pt=8.5):
    ax.figure.canvas.draw(); dpi = ax.figure.dpi / 72.0
    pts = sorted(((ax.transData.transform((x, y))[1], x, y, c, t) for x, y, c, t in ends), reverse=True)
    prev = None
    for dy, x, y, c, t in pts:
        yy = dy if prev is None else min(dy, prev - gap_pt * dpi); prev = yy
        ax.annotate(t, xy=(x, y), xytext=(5, (yy - dy) / dpi), textcoords="offset points", color=c, va="center", ha="left",
                    fontsize=7.4, weight="bold", annotation_clip=False, bbox=dict(boxstyle="square,pad=0.08", fc="white", ec="none", alpha=.85))

def panel(bench, mode, axis, fname, title):
    fig, ax = plt.subplots(figsize=(5.4, 4.9), dpi=200)
    ax.grid(True, axis="y", zorder=0); ax.set_axisbelow(True)
    handles, ends, xmax = [], [], 0
    base_names = ["Meta-Harness", "DGM", "GEPA", "ShinkaEvolve", "OpenEvolve"]
    for name in base_names:
        if bench == "games":
            key = [k for k, v in GAMES_METHOD.items() if v == name][0]; xs, ys, ng = games_curves(key, axis=axis)
        else:
            xs, ys = balrog_curve(name, axis=axis)
        if not xs: continue
        ax.step(xs, ys, where="post", color=BASE[name], lw=1.4, zorder=3, alpha=0.95)
        ends.append((xs[-1], ys[-1], BASE[name], f"{ys[-1]:.1f}")); xmax = max(xmax, xs[-1])
        handles.append(Line2D([], [], color=BASE[name], lw=1.4, label=name))
    for k0 in [2, 4, 8, 16, 32]:
        if bench == "games":
            xs, ys, ng = games_curves("ours", mode, k0, axis)
            if not xs or ng < 4: continue
        else:
            xs, ys = balrog_curve("ours", mode, k0, axis)
            if not xs: continue
        ax.step(xs, ys, where="post", color=BLUES[k0], lw=2.2, zorder=5)
        ax.plot([xs[-1]], [ys[-1]], "o", ms=3.4, color=BLUES[k0], zorder=6)
        ends.append((xs[-1], ys[-1], BLUES[k0], f"{ys[-1]:.1f}")); xmax = max(xmax, xs[-1])
        handles.append(Line2D([], [], color=BLUES[k0], lw=2.2, label=f"Harness-MAP {mode} (k₀={k0})"))
    if bench == "games":
        ax.axhline(QWEN_GAMES, color="#777", ls=(0, (4, 3)), lw=1.0, zorder=1)
        ends.append((xmax, QWEN_GAMES, "#777", f"{QWEN_GAMES:.1f}"))
        handles.append(Line2D([], [], color="#777", ls=(0, (4, 3)), lw=1.0, label="Qwen3-VL naive (no evolution)"))
    else:
        ax.axhspan(100 * anchor["min"], 100 * anchor["max"], color="#000", alpha=0.06, zorder=0, lw=0)
        ax.axhline(100 * anchor["mean"], color="#777", ls=(0, (4, 3)), lw=1.0, zorder=1)
        ends.append((xmax, 100 * anchor["mean"], "#777", f"{100*anchor['mean']:.1f}"))
        handles.append(Line2D([], [], color="#777", ls=(0, (4, 3)), lw=1.0, label=f"BALROG naive agent ({anchor['n']} replicates, band = range)"))
    label_endpoints(ax, ends)
    xr = 50 if axis == "n" else xmax
    ax.set_xlim(-0.5, xr * 1.14); ax.set_ylim(0, 103); ax.set_yticks([0, 20, 40, 60, 80, 100])
    if axis == "n": ax.set_xticks([0, 10, 20, 30, 40, 50])
    ax.set_xlabel("harness evaluations  N" if axis == "n" else "sequential proposal steps  T")
    ax.set_ylabel("best-so-far success rate (%)" if bench == "balrog" else "best-so-far success rate, mean over 5 games (%)")
    ax.set_title(title, loc="left", weight="bold", fontsize=10)
    ax.legend(handles=handles, loc="upper center", bbox_to_anchor=(0.5, -0.14), ncol=3, frameon=False, fontsize=7.2, columnspacing=1.0, handlelength=1.6)
    fig.savefig(OUT / f"{fname}.png", bbox_inches="tight", facecolor="white"); plt.close(fig)
    print(fname, "endpoints:", [(t, round(y, 1)) for _, y, _, t in ends][-7:])

for bench, bname in [("games", "SpatialWorld-3DGames"), ("balrog", "BALROG-MiniHack")]:
    panel(bench, "adaptive", "n", f"fig3_{bench}_adaptive_N", f"{bname} · adaptive resolution · vs. evaluations N")
    panel(bench, "adaptive", "t", f"fig3_{bench}_adaptive_T", f"{bname} · adaptive resolution · vs. sequential steps T")
    panel(bench, "fixed", "n", f"fig3_{bench}_fixed_N", f"{bname} · fixed resolution · vs. N")
    panel(bench, "hier", "n", f"fig3_{bench}_hier_N", f"{bname} · hierarchical resolution · vs. N")
# sanity: print games per (mode,k0) status
st = collections.Counter((a["mode"], a["k0"], a["status"], a.get("k0_valid")) for a in G if a["method"] == "ours")
print(sorted(st.items(), key=str))
