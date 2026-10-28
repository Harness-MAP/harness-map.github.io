import sys, os, glob, subprocess, time
S = "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad"
sys.path.insert(0, f"{S}/pylib")
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = f"{S}/pw"
os.environ["LD_LIBRARY_PATH"] = f"{S}/deb/ex/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
SITE = "/home/azureuser/workspace/harness-evolution.github.io"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1", "-d", SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
exe = glob.glob(f"{S}/pw/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")[0]
OUT = f"{S}/shots"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox", "--disable-gpu"])
        for width, tag in [(1280, "desk"), (390, "phone")]:
            pg = b.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
            logs = []
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
            pg.goto("http://127.0.0.1:8765/index.html", wait_until="networkidle"); pg.wait_for_timeout(1200)
            print(tag, "page height", pg.evaluate("document.documentElement.scrollHeight"), "| hscroll overflow:", pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"))
            def shot(sel, name):
                el = pg.query_selector(sel)
                if not el: print("  missing", sel); return
                el.scroll_into_view_if_needed(); pg.wait_for_timeout(250); el.screenshot(path=f"{OUT}/{tag}_{name}.png")
            shot("header", "01_hero"); shot("section.teaser", "02_teaser"); shot("#abstract", "03_abstract"); shot("#method", "04_method")
            for _ in range(3): pg.click("#demo [data-act=step]"); pg.wait_for_timeout(150)
            shot("#demo", "05_demo")
            shot("#results", "06_results")
            pg.click("#tab-fig3-balrog"); pg.click("#tab-res-balrog"); pg.wait_for_timeout(200); shot("#results", "06b_results_balrog_tabs")
            shot("#evolution", "07_evolution_balrog")
            pg.click("#tab-evo-games"); pg.wait_for_timeout(300); shot("#evolution", "08_evolution_games")
            pg.click("#tab-game-block3d"); pg.wait_for_timeout(300); shot("#evolution", "08b_evolution_block3d")
            pg.click("#tab-evo-nav"); pg.wait_for_timeout(300); shot("#evolution", "09_evolution_nav")
            shot("#code", "10_code"); shot("#bibtex", "11_bibtex"); shot("footer", "12_footer")
            # interaction: click a lineage node on balrog tab and check the player caption changes
            pg.click("#tab-evo-balrog"); pg.wait_for_timeout(200)
            rects = pg.query_selector_all("#chart-balrog rect[role=button]")
            before = pg.inner_text("#player-balrog .cap .text"); rects[13].click(); pg.wait_for_timeout(300); after = pg.inner_text("#player-balrog .cap .text")
            print(f"  balrog click test: {len(rects)} targets; caption before: {before[:60]!r} after: {after[:60]!r}")
            print("  video src now:", pg.get_attribute("#player-balrog video", "src"))
            print("  paper button class:", pg.get_attribute("#btn-paper", "class"))
            print("  console:", logs or "clean")
            pg.close()
        b.close()
finally:
    srv.terminate()
