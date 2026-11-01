#!/usr/bin/env python3
"""Second media pass for the evolution packs: Rubik videos and lineage from the pack, every SimWorld-hard harness video,
and the BALROG videos per task (one entry list per task, the anchor first) so the page can pair the anchor with each
evolved harness.  Extends static/data/videos.json and static/data/lineages.json in place."""
import json, re, subprocess, sys
from pathlib import Path
sys.path.insert(0, "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/pylib_mpl")
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
E = Path("/home/azureuser/workspace/HarnessMAP/examples"); SITE = Path(__file__).resolve().parent.parent
V, P, DATA = SITE / "static/videos", SITE / "static/posters", SITE / "static/data"
def remux(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True); subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)], check=True); return dst
def poster(src, dst, t="0.5"):
    dst.parent.mkdir(parents=True, exist_ok=True); subprocess.run([FF, "-y", "-loglevel", "error", "-ss", t, "-i", str(src), "-frames:v", "1", "-q:v", "5", str(dst)], check=True); return dst
def probe(src):
    r = subprocess.run([FF, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r); dur = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    m2 = re.search(r", (\d{2,5})x(\d{2,5})", r); return round(dur, 1), int(m2[1]), int(m2[2])
videos = json.load(open(DATA / "videos.json")); lineages = json.load(open(DATA / "lineages.json"))

# ---------------------------------------------------------------- Rubik: lineage rows and the four level-6 videos from the pack
lin = json.load(open(E / "spatialworld_games/evolution/rubik/lineage.json")); H = lin["harnesses"]; idx_of = {h["label"]: h["index"] for h in H}
lineages["games_rubik"] = dict(title=lin["meta"]["title"], primary="score", best=lin["meta"]["best_primary"], best_label=lin["meta"]["best_label"], first_at=lin["meta"]["first_reached_at_eval"],
    n=lin["meta"]["n_harnesses"], n_run=lin["meta"]["n_evaluated_in_run"], run=lin["meta"]["run"],
    rows=[dict(i=h["index"], label=h["label"], p=idx_of.get(h["parent"]) if h["parent"] else None, score=h["primary"], path=h["on_path_to_best"], best=h["is_best"], depth=h["cell_depth"], diff=h.get("diff_vs_parent"), nfiles=h["n_files"], heading=h.get("heading", "")) for h in H])
entries = []
for m in json.load(open(E / "spatialworld_games/evolution/rubik/videos/manifest.json")):
    if m["index"] is None: continue
    src = E / "spatialworld_games/evolution/rubik/videos" / m["file"]; name = f"rubik_{m['index']:02d}"
    dst = remux(src, V / "games" / f"{name}.mp4"); poster(dst, P / "games" / f"{name}.jpg"); dur, w, h = probe(dst); hh = H[m["index"]]
    entries.append(dict(i=m["index"], label=m["label"], file=f"static/videos/games/{name}.mp4", poster=f"static/posters/games/{name}.jpg", level=m.get("level"), dur=dur, w=w, h=h,
                        episode_score=m.get("score"), steps=m.get("steps"), score=hh["primary"], on_path=hh["on_path_to_best"], best=hh["is_best"]))
videos["games"]["rubik"] = entries; print("rubik:", len(entries), "videos,", len(H), "lineage rows")

# ---------------------------------------------------------------- SimWorld hard: all four harness videos of the pack, indexed by lineage row
rows = lineages["nav_hard"]["rows"]; idx_of = {r["label"]: r["i"] for r in rows}; entries = []
for m in json.load(open(E / "simworld_nav/evolution/videos/manifest.json")):
    if m["label"] not in idx_of: continue
    i = idx_of[m["label"]]; name = f"nav_hard_{i:02d}"; src = E / "simworld_nav/evolution/videos" / m["file"]
    dst = remux(src, V / "nav" / f"{name}.mp4"); poster(dst, P / "nav" / f"{name}.jpg", t="5"); dur, w, h = probe(dst)
    entries.append(dict(i=i, label=m["label"], file=f"static/videos/nav/{name}.mp4", poster=f"static/posters/nav/{name}.jpg", episode=m["episode"], subtask_sr=m.get("subtask_sr"), steps=m.get("steps"),
                        final_dist=m.get("final_dist_to_target"), dur=dur, w=w, h=h, score=rows[i]["score"], on_path=rows[i]["path"], best=rows[i]["best"]))
entries.sort(key=lambda e: e["i"]); videos["nav"] = entries; print("nav hard:", [e["label"] for e in entries])

# ---------------------------------------------------------------- BALROG: one entry list per task; MazeWalk keeps the 41 remuxed earlier
readme = (E / "balrog/evolution/README.md").read_text(); outcomes = {}
for m in re.finditer(r"\| \[`([^`]+\.mp4)`\]\([^)]*\) \| `([^`]+)` \(eval (\d+)\) \| ([^|]+) \|", readme): outcomes[m[1]] = m[4].strip()
lin = json.load(open(E / "balrog/evolution/lineage.json")); H = lin["harnesses"]; by_label = {h["label"]: h for h in H}
tasks = []
for task, run in [("MazeWalk-15x15", "run00"), ("Corridor-R3", "run04"), ("Boxoban-Medium", "run00"), ("Quest-Easy", "run00")]:
    key = task.lower().replace("-", "_"); ents = []
    for src in sorted((E / "balrog/evolution/videos").glob(f"MiniHack-{task}-v0_{run}__??_*.mp4")):
        mm = re.match(rf"MiniHack-{re.escape(task)}-v0_{run}__(\d\d)_(.+)\.mp4$", src.name)
        if not mm: continue
        i, lab = int(mm[1]), mm[2]; h = by_label[lab]
        if task == "MazeWalk-15x15":
            prev = next(e for e in videos["balrog"]["mazewalk"] if e["i"] == i); file, po, dur, w, hh = prev["file"], prev["poster"], prev["dur"], prev["w"], prev["h"]
        else:
            name = f"{key}_{i:02d}"; dst = remux(src, V / "balrog" / f"{name}.mp4"); poster(dst, P / "balrog" / f"{name}.jpg"); dur, w, hh = probe(dst)
            file, po = f"static/videos/balrog/{name}.mp4", f"static/posters/balrog/{name}.jpg"
        ents.append(dict(i=i, label=lab, file=file, poster=po, outcome=outcomes.get(src.name, ""), episode_score=dict(h["episodes"]).get(f"MiniHack-{task}-v0/{run[-2:]}"), dur=dur, w=w, h=hh,
                         score=h["primary"], on_path=h["on_path_to_best"], best=h["is_best"]))
    if task == "MazeWalk-15x15":   # the full set of 41, not only the four on the path
        ents = [dict(e, episode=f"{task} {run}") for e in videos["balrog"]["mazewalk"]]
    tasks.append(dict(task=task, run=run, episode=f"{task} {run}", entries=sorted(ents, key=lambda e: e["i"])))
    print("balrog task", task, [e["label"].split("_")[1] if "_" in e["label"] else e["label"] for e in tasks[-1]["entries"]][:6], "…", len(tasks[-1]["entries"]))
videos["balrog"]["tasks"] = tasks; videos["balrog"].pop("grids", None)
json.dump(videos, open(DATA / "videos.json", "w"), indent=1); json.dump(lineages, open(DATA / "lineages.json", "w"), indent=1); print("written")
