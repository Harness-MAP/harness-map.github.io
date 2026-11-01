#!/usr/bin/env python3
"""Replace the 41 MazeWalk-15x15 harness videos with the shared-crop replays (scratchpad/balrog_render/mw15) so every
pair in that tab has the same frame; refreshes posters and the sizes in static/data/videos.json."""
import json, re, subprocess, sys
from pathlib import Path
sys.path.insert(0, "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/pylib_mpl")
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); SITE = Path(__file__).resolve().parent.parent; SRC = Path("/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/balrog_render/mw15")
V, P, DATA = SITE / "static/videos/balrog", SITE / "static/posters/balrog", SITE / "static/data"
def probe(src):
    r = subprocess.run([FF, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r); m2 = re.search(r", (\d{2,5})x(\d{2,5})", r); return round(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]), 1), int(m2[1]), int(m2[2])
videos = json.load(open(DATA / "videos.json")); n = 0; sizes = set()
for e in videos["balrog"]["mazewalk"]:
    src = SRC / f"mazewalk15_{e['i']:02d}.mp4"
    if not src.exists(): print("MISSING", src.name); continue
    dst = V / f"mazewalk15_{e['i']:02d}.mp4"
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)], check=True)
    subprocess.run([FF, "-y", "-loglevel", "error", "-ss", "0.5", "-i", str(dst), "-frames:v", "1", "-q:v", "5", str(P / f"mazewalk15_{e['i']:02d}.jpg")], check=True)
    e["dur"], e["w"], e["h"] = probe(dst); sizes.add((e["w"], e["h"])); n += 1
t = next(t for t in videos["balrog"]["tasks"] if t["task"] == "MazeWalk-15x15"); by = {e["i"]: e for e in videos["balrog"]["mazewalk"]}
for e in t["entries"]:
    if e["i"] in by: e["dur"], e["w"], e["h"] = by[e["i"]]["dur"], by[e["i"]]["w"], by[e["i"]]["h"]
json.dump(videos, open(DATA / "videos.json", "w"), indent=1); print("replaced", n, "videos; sizes:", sizes)
