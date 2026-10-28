import json, re, os, subprocess, shutil, sys
from pathlib import Path
sys.path.insert(0, "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/pylib")
import pymupdf, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
E = Path("/home/azureuser/workspace/HarnessMAP/examples")
A = Path("/home/azureuser/workspace/AutoSpatial")
SITE = Path("/home/azureuser/workspace/harness-evolution.github.io")
V = SITE/"static/videos"; P = SITE/"static/posters"; IMG = SITE/"static/img"; DATA = SITE/"static/data"

def remux(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)], check=True)
    return dst
def poster(src, dst, t="0.5"):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-y", "-loglevel", "error", "-ss", t, "-i", str(src), "-frames:v", "1", "-q:v", "5", str(dst)], check=True)
    return dst
def probe(src):
    r = subprocess.run([FF, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r); dur = int(m[1])*3600+int(m[2])*60+float(m[3])
    m2 = re.search(r", (\d{2,5})x(\d{2,5})", r); return dur, int(m2[1]), int(m2[2])

manifest = {"balrog": {"mazewalk": [], "grids": []}, "games": {}, "nav": {}}

# ---- BALROG: outcomes from the README video table
readme = (E/"balrog/evolution/README.md").read_text()
outcomes = {}
for m in re.finditer(r"\| \[`([^`]+\.mp4)`\]\([^)]*\) \| `([^`]+)` \(eval (\d+)\) \| ([^|]+) \|", readme):
    outcomes[m[1]] = (m[2], int(m[3]), m[4].strip())
lin = json.load(open(E/"balrog/evolution/lineage.json"))
for h in lin["harnesses"]:
    i = h["index"]; lab = h["label"]
    fn = f"MiniHack-MazeWalk-15x15-v0_run00__{i:02d}_{lab}.mp4"
    src = E/"balrog/evolution/videos"/fn
    if not src.exists(): print("MISSING", src); continue
    dst = remux(src, V/"balrog"/f"mazewalk15_{i:02d}.mp4"); po = poster(dst, P/"balrog"/f"mazewalk15_{i:02d}.jpg")
    dur, w, hh = probe(dst)
    ep = dict(h["episodes"]).get("MiniHack-MazeWalk-15x15-v0/00")
    manifest["balrog"]["mazewalk"].append({"i": i, "label": lab, "file": f"static/videos/balrog/mazewalk15_{i:02d}.mp4",
        "poster": f"static/posters/balrog/mazewalk15_{i:02d}.jpg", "outcome": outcomes.get(fn, ("", 0, ""))[2],
        "episode_score": ep, "dur": round(dur,1), "w": w, "h": hh, "score": h["primary"], "on_path": h["on_path_to_best"], "best": h["is_best"]})
for task, run in [("MazeWalk-15x15", "run00"), ("Corridor-R3", "run04"), ("Boxoban-Medium", "run00"), ("Quest-Easy", "run00")]:
    fn = f"MiniHack-{task}-v0_{run}__path_to_best_grid.mp4"; src = E/"balrog/evolution/videos"/fn
    key = task.lower().replace("-", "_")
    dst = remux(src, V/"balrog"/f"grid_{key}.mp4"); po = poster(dst, P/"balrog"/f"grid_{key}.jpg")
    dur, w, hh = probe(dst)
    manifest["balrog"]["grids"].append({"task": task, "episode": f"{task} {run}", "file": f"static/videos/balrog/grid_{key}.mp4",
        "poster": f"static/posters/balrog/grid_{key}.jpg", "dur": round(dur,1), "w": w, "h": hh})

# ---- games
for g in ["maze", "maze3d_pro", "block3d", "snake"]:
    man = json.load(open(E/f"spatialworld_games/evolution/{g}/videos/manifest.json"))
    lin = json.load(open(E/f"spatialworld_games/evolution/{g}/lineage.json"))
    byidx = {h["index"]: h for h in lin["harnesses"]}
    entries = []
    for m in man:
        src = E/f"spatialworld_games/evolution/{g}/videos"/m["file"]
        if m["index"] is None:
            name = f"{g}_anchor_vs_best"
        else:
            name = f"{g}_{m['index']:02d}"
        dst = remux(src, V/"games"/f"{name}.mp4"); po = poster(dst, P/"games"/f"{name}.jpg")
        dur, w, hh = probe(dst)
        e = {"i": m["index"], "label": m["label"], "file": f"static/videos/games/{name}.mp4", "poster": f"static/posters/games/{name}.jpg",
             "level": m.get("level"), "dur": round(dur,1), "w": w, "h": hh}
        if m["index"] is not None:
            e.update({"episode_score": m.get("score"), "steps": m.get("steps"), "score": byidx[m["index"]]["primary"],
                      "on_path": byidx[m["index"]]["on_path_to_best"], "best": byidx[m["index"]]["is_best"]})
        entries.append(e)
    manifest["games"][g] = entries

# ---- nav
man = json.load(open(E/"simworld_nav/evolution/videos/manifest.json"))
entries = []
for m in man:
    src = E/"simworld_nav/evolution/videos"/m["file"]
    name = "nav_" + ("anchor_vs_best" if m["label"] == "anchor_vs_best" else ("anchor" if m["label"] == "anchor_nav" else "best"))
    dst = remux(src, V/"nav"/f"{name}.mp4"); po = poster(dst, P/"nav"/f"{name}.jpg", t="5")
    dur, w, hh = probe(dst)
    entries.append({"label": m["label"], "file": f"static/videos/nav/{name}.mp4", "poster": f"static/posters/nav/{name}.jpg",
                    "episode": m["episode"], "subtask_sr": m.get("subtask_sr"), "steps": m.get("steps"),
                    "final_dist": m.get("final_dist_to_target"), "dur": round(dur,1), "w": w, "h": hh})
manifest["nav"] = entries
DATA.mkdir(parents=True, exist_ok=True)
json.dump(manifest, open(DATA/"videos.json", "w"), indent=1)
shutil.copy("/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/lineages.json", DATA/"lineages.json")

# ---- figures from PDFs
def pdf2png(src, dst, width_px):
    d = pymupdf.open(str(src)); p = d[0]; zoom = width_px / p.rect.width
    pix = p.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False); pix.save(str(dst)); return pix.width, pix.height, os.path.getsize(dst)
IMG.mkdir(parents=True, exist_ok=True)
jobs = [
    ("/home/azureuser/workspace/HarnessMAP/assets/teaser.pdf", IMG/"fig1_teaser.png", 2400),
    (A/"spatial_world/figures/figure2_harness_map.pdf", IMG/"fig2_structure_token.png", 2000),
    (A/"spatial_world/figures/figs_3dgames_codex/fig6_resolution.pdf", IMG/"fig4_games_resolution.png", 2200),
    (A/"spatial_world/figures/figs_3dgames_codex/fig5_pergame_vs_N.pdf", IMG/"fig6_games_pergame_N.png", 2200),
    (A/"spatial_world/figures/figs_3dgames_codex/fig5_pergame_vs_T.pdf", IMG/"fig6_games_pergame_T.png", 2200),
    (A/"balrog/figures/fig5_per_task.pdf", IMG/"fig7_balrog_pertask.png", 2200),
    (A/"balrog/figures/fig6_resolution.pdf", IMG/"fig8_balrog_resolution.png", 1800),
]
for src, dst, wpx in jobs:
    print(dst.name, pdf2png(src, dst, wpx))
# social preview 1200x630 from the teaser
from PIL import Image
im = Image.open(IMG/"fig1_teaser.png").convert("RGB"); W, H = im.size
tw, th = 1200, 630; scale = min(tw/W, th/H); im2 = im.resize((int(W*scale), int(H*scale)), Image.LANCZOS)
canvas = Image.new("RGB", (tw, th), (255, 255, 255)); canvas.paste(im2, ((tw-im2.width)//2, (th-im2.height)//2)); canvas.save(IMG/"og_preview.jpg", quality=88)
print("videos:", sum(1 for _ in V.rglob("*.mp4")), "posters:", sum(1 for _ in P.rglob("*.jpg")))
print("site video MB:", round(sum(f.stat().st_size for f in V.rglob("*.mp4"))/1e6, 2))
