# Harness-MAP project page

Source of the project page for **Harness-MAP: Budget-Efficient Harness Search via Structure-Token
Factorization** (Mei Yuan, Yingshan Chang, Daniel Fried, Yonatan Bisk; Carnegie Mellon University).
Code release: https://github.com/Harness-MAP/harness-evolution

The page is a single static `index.html` with hand-written CSS and JavaScript (no framework, no build
tool at serve time). GitHub Pages serves it from the root of the `main` branch.

## Publishing

1. In the repository settings, open **Pages**, set *Source* to "Deploy from a branch", branch `main`,
   folder `/ (root)`, and save. The site appears at the URL shown there within a minute or two.
2. The paper's own URL is `https://harness-map.github.io/`. A repository under the `Harness-MAP`
   organization only gets that root URL if it is named `harness-map.github.io`; as
   `harness-evolution.github.io` the page is served at
   `https://harness-map.github.io/harness-evolution.github.io/`. Renaming the repository to
   `harness-map.github.io` is enough to switch; every link in the page is relative, so nothing else
   changes. The `og:image` URL in the `<head>` of `index.html` is the only absolute URL and should be
   updated after a rename.
3. The **Paper (PDF)** button points at `static/paper/harness-map.pdf`. Until that file exists the
   button shows a "soon" tag (the page checks with a HEAD request). Drop the PDF there and push.

## Layout

```
index.html                 the page (generated from tools/index.template.html; see below)
static/css/style.css       styles, light and dark colour schemes
static/js/main.js          tabs, lineage charts wired to the episode videos, adaptive-resolution demo
static/img/                figures (see the table below)
static/videos/             episode videos from the code release's evolution packs (H.264, faststart)
static/posters/            one poster frame per video
static/data/               lineages.json and videos.json (also embedded in index.html)
static/paper/              put harness-map.pdf here
tools/                     the scripts that produced the figures, videos and index.html
```

## Figures and their provenance

The paper's figures were not available as separate files when this page was built, so several are
re-renderings from the same data. Replace a file in `static/img/` with the original under the same
name and the page picks it up; if an original has a different aspect ratio, also update the
`width`/`height` attributes on its `<img>` in `index.html` (they only reserve layout space).

| file | paper figure | status |
|---|---|---|
| `fig1_teaser.png` | Figure 1 (teaser) | rendered from `assets/teaser.pdf` of the code release (the original vector figure) |
| `fig2_structure_token.png` | Figure 2 (Rubik candidates, structure vs. token) | **placeholder**: the pre-layout render of the same four candidates (`figure2_harness_map.pdf`); the paper's 2×2 layout should replace it |
| `fig3_games_*.png`, `fig3_balrog_*.png` | Figure 3 (search curves) | **re-plotted** by `tools/curves.py` from the per-evaluation score logs, with the paper's plain mean over the five games; endpoints match Tables 1, 7, 8 and 10 except the games' fixed/hier k₀ = 16, 32 cells (one point below Table 8, whose final cells were re-seeded after the logs were archived) |
| `fig4_games_resolution.png` | Figure 4 | rendered from `figs_3dgames_codex/fig6_resolution.pdf` |
| `fig5_partitioning.svg` | Figure 5 (conceptual partitioning) | **re-drawn** by `tools/fig5.py` |
| `fig6_games_pergame_N.png`, `fig6_games_pergame_T.png` | Figure 6 | rendered from `figs_3dgames_codex/fig5_pergame_vs_{N,T}.pdf` |
| `fig7_balrog_pertask.png` | Figure 7 | rendered from `balrog/figures/fig5_per_task.pdf` |
| `fig8_balrog_resolution.png` | Figure 8 | rendered from `balrog/figures/fig6_resolution.pdf` |
| `favicon.svg` | — | drawn by `tools/fig5.py` after the paper's title icon |
| `og_preview.jpg` | — | social-preview crop of the teaser |

## Videos

`tools/media.py` copies the evolution-pack videos from the code release (`examples/*/evolution/`),
remuxes them with a faststart MP4 header, renames them, writes a poster frame for each, and writes
`static/data/videos.json`. Included: the 41 BALROG harnesses on MazeWalk-15x15 episode 00 and the four
path-to-best grids; every harness of the Maze3D-Pro, Block3D, Maze and Snake runs on one level plus the
anchor-vs-best side-by-sides; the navigation anchor-vs-best re-run. About 12 MB in total.

## Rebuilding `index.html`

`index.html` is `tools/index.template.html` with `static/data/lineages.json` and
`static/data/videos.json` embedded (so the page needs no fetch and works from `file://`):

```bash
python tools/build_index.py      # also checks that every local reference exists
```

Edit the template, not `index.html`, if you want to keep the two in sync; editing `index.html`
directly is fine too (the embedded data blocks are just two `<script type="application/json">` tags
at the bottom). The scripts in `tools/` reference the machine the page was built on
(`/home/azureuser/...`); `tools/qa.py` screenshots the page section by section with a headless
Chromium and is how the layout was checked.
