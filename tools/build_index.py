import json, re, os, sys
from pathlib import Path
S = Path("/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad/build")
SITE = Path("/home/azureuser/workspace/harness-evolution.github.io")
tpl = (S / "index.template.html").read_text()
lin = json.load(open(SITE / "static/data/lineages.json")); vid = json.load(open(SITE / "static/data/videos.json"))
def js(o): return json.dumps(o, separators=(",", ":")).replace("</", "<\\/")
html = tpl.replace("__LINEAGES_JSON__", js(lin)).replace("__VIDEOS_JSON__", js(vid))
# BALROG grid videos: render the four players statically
grids = ""
for g in vid["balrog"]["grids"]:
    grids += (f'<div class="player"><video controls muted playsinline preload="none" poster="{g["poster"]}" src="{g["file"]}" width="{g["w"]}" height="{g["h"]}"></video>'
              f'<div class="cap"><span class="text"><b>{g["task"]}</b>, episode {g["episode"].split()[-1][-2:]}: anchor, cand_r35_0, cand_r41_0, cand_r68_0</span></div></div>')
html = html.replace('<div class="vgrid two" id="grids-balrog"></div>', f'<div class="vgrid two" id="grids-balrog">{grids}</div>')
(SITE / "index.html").write_text(html)
# link check: every local reference must exist
missing = []
for ref in set(re.findall(r'(?:src|href|poster)="(static/[^"]+)"', html)):
    if not (SITE / ref).exists(): missing.append(ref)
for section in [vid["balrog"]["mazewalk"], vid["balrog"]["grids"], vid["nav"]] + list(vid["games"].values()):
    for e in section:
        for k in ("file", "poster"):
            if e.get(k) and not (SITE / e[k]).exists(): missing.append(e[k])
print("index.html bytes:", len(html), "| missing local refs:", missing or "none")
