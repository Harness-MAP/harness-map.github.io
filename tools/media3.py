#!/usr/bin/env python3
"""Add the engine replays of the anchor and the best BALROG harness on the four MiniHack tasks that had no pack video
(rendered with examples/render/replay_balrog_episode.py --check into the scratchpad) as four more task tabs."""
import json, re, subprocess, sys
from pathlib import Path
sys.path.insert(0, "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/pylib_mpl")
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); SITE = Path(__file__).resolve().parent.parent; SRC = Path("/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/balrog_render")
V, P, DATA = SITE / "static/videos/balrog", SITE / "static/posters/balrog", SITE / "static/data"
LOG = Path("/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/tasks/bf1mzyu74.output").read_text()
steps = {m[1]: int(m[2]) for m in re.finditer(r"balrog_render/([^/]+)\.mp4: (\d+) steps replayed and verified", LOG)}
lin = json.load(open("/home/azureuser/workspace/HarnessMAP/examples/balrog/evolution/lineage.json")); H = lin["harnesses"]; anchor = H[0]; best = next(h for h in H if h["is_best"])
def probe(src):
    r = subprocess.run([FF, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r); m2 = re.search(r", (\d{2,5})x(\d{2,5})", r); return round(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]), 1), int(m2[1]), int(m2[2])
videos = json.load(open(DATA / "videos.json")); have = {t["task"] for t in videos["balrog"]["tasks"]}
for task, run in [("Boxoban-Hard", "00"), ("CorridorBattle-Dark", "04"), ("MazeWalk-9x9", "00"), ("Quest-Medium", "00")]:
    if task in have: continue
    key = task.lower().replace("-", "_"); ents = []
    for who, h in (("anchor", anchor), ("best", best)):
        src = SRC / f"{task}_run{run}__{who}.mp4"; name = f"{key}_{h['index']:02d}"; dst = V / f"{name}.mp4"
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)], check=True)
        subprocess.run([FF, "-y", "-loglevel", "error", "-ss", "0.5", "-i", str(dst), "-frames:v", "1", "-q:v", "5", str(P / f"{name}.jpg")], check=True)
        dur, w, hh = probe(dst); sc = dict(h["episodes"]).get(f"MiniHack-{task}-v0/{run}"); n = steps.get(f"{task}_run{run}__{who}")
        ents.append(dict(i=h["index"], label=h["label"], file=f"static/videos/balrog/{name}.mp4", poster=f"static/posters/balrog/{name}.jpg", outcome=(f"solved in {n} steps" if sc == 1 else f"failed in {n} steps"),
                         episode_score=sc, dur=dur, w=w, h=hh, score=h["primary"], on_path=h["on_path_to_best"], best=h["is_best"], replay="engine replay of the logged episode"))
    videos["balrog"]["tasks"].append(dict(task=task, run=f"run{run}", episode=f"{task} run{run}", entries=ents)); print(task, [(e["label"], e["outcome"]) for e in ents])
order = ["MazeWalk-9x9", "MazeWalk-15x15", "Corridor-R3", "CorridorBattle-Dark", "Boxoban-Medium", "Boxoban-Hard", "Quest-Easy", "Quest-Medium"]
videos["balrog"]["tasks"].sort(key=lambda t: order.index(t["task"]) if t["task"] in order else 99)
json.dump(videos, open(DATA / "videos.json", "w"), indent=1); print("tasks:", [t["task"] for t in videos["balrog"]["tasks"]])
