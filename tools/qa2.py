import sys, os, glob, subprocess, time
S = "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad"
sys.path.insert(0, f"{S}/pylib")
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = f"{S}/pw"
os.environ["LD_LIBRARY_PATH"] = f"{S}/deb/ex/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
SITE = "/home/azureuser/workspace/harness-evolution.github.io"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766", "--bind", "127.0.0.1", "-d", SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
exe = glob.glob(f"{S}/pw/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")[0]
OUT = f"{S}/shots"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox", "--disable-gpu"])
        def session(width, tag, dark=False):
            pg = b.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
            if dark: pg.emulate_media(color_scheme="dark")
            logs = []
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
            pg.goto("http://127.0.0.1:8766/index.html", wait_until="networkidle"); pg.wait_for_timeout(1000)
            def shot(sel, name):
                el = pg.query_selector(sel); el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); el.screenshot(path=f"{OUT}/{tag}_{name}.png")
            return pg, shot, logs
        pg, shot, logs = session(1280, "v2desk")
        shot("#fig3-games", "fig3grid")
        pg.click("#tab-evo-games"); pg.wait_for_timeout(400); shot("#evo-games", "games_maze3d")
        pg.click("#tab-game-block3d"); pg.wait_for_timeout(400); shot("#evo-games", "games_block3d")
        pg.click("#tab-game-rubik"); pg.wait_for_timeout(400); shot("#evo-games", "games_rubik")
        # click a maze3d node and verify the player follows
        pg.click("#tab-game-maze3d_pro"); pg.wait_for_timeout(300)
        rects = pg.query_selector_all("#chart-maze3d_pro rect[role=button]"); rects[3].click(); pg.wait_for_timeout(300)
        print("maze3d click:", len(rects), "targets ->", pg.inner_text("#player-maze3d_pro .cap .text")[:90], "|", pg.get_attribute("#player-maze3d_pro video", "src"))
        print("hidden game panels after switching:", pg.evaluate("[...document.querySelectorAll('#evo-games [role=tabpanel]')].map(p=>p.id+':'+p.hidden).join(' ')"))
        print("desk console:", logs or "clean"); pg.close()
        pg, shot, logs = session(390, "v2phone")
        pg.click("#tab-evo-games"); pg.wait_for_timeout(500); shot("#evo-games", "games_maze3d")
        pg.click("#tab-evo-balrog"); pg.wait_for_timeout(500); shot("#chart-balrog", "chart_balrog")
        print("phone chart svg viewBox:", pg.get_attribute("#chart-balrog svg", "viewBox"), "| hscroll:", pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"))
        print("phone console:", logs or "clean"); pg.close()
        pg, shot, logs = session(1280, "v2dark", dark=True)
        shot("header", "hero"); shot("#demo", "demo"); shot("#results .scroll", "table1")
        shot("#evolution", "evolution")
        print("dark console:", logs or "clean"); pg.close()
        b.close()
finally:
    srv.terminate()
