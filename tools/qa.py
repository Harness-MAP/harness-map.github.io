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
        def session(width, tag, dark=False):
            pg = b.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
            if dark: pg.emulate_media(color_scheme="dark")
            logs = []
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
            pg.goto("http://127.0.0.1:8765/index.html", wait_until="networkidle"); pg.wait_for_timeout(1200)
            # hide the sticky nav for element screenshots so it does not overlap
            pg.add_style_tag(content=".topnav{position:static!important}")
            def shot(sel, name):
                e = pg.query_selector(sel)
                if not e: print("  missing", sel); return
                e.scroll_into_view_if_needed(); pg.wait_for_timeout(300); e.screenshot(path=f"{OUT}/{tag}_{name}.png")
            print(tag, "height", pg.evaluate("document.documentElement.scrollHeight"), "| hscroll:", pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"))
            return pg, shot, logs
        for width, tag, dark in [(1280, "desk", False), (390, "phone", False), (1280, "dark", True)]:
            pg, shot, logs = session(width, tag, dark)
            shot("header.hero", "01_hero"); shot("#idea", "02_idea"); shot(".steps3", "03_steps"); shot("#lab-factor", "04_factor"); shot("#lab-loop", "05_loop"); shot("#lab-adapt", "06_adapt")
            shot("#barcards", "07_table1"); shot("#lab-dyn", "08_dyn"); shot("#lab-res", "09_res"); shot("#lab-qd", "10_qd"); shot("#lab-abl", "11_abl"); shot("#lab-gen", "12_gen")
            shot("#evolution", "13_evo_balrog"); shot("#cases", "15_cases"); shot("#bibtex", "16_bibtex")
            if tag == "desk":
                pg.click("#lab-dyn [data-ctl=bench] [data-v=nav_hard]"); pg.wait_for_timeout(400); shot("#lab-dyn", "08b_dyn_navhard")
                pg.click("#lab-dyn [data-ctl=bench] [data-v=nav_easy]"); pg.click("#lab-dyn [data-ctl=axis] [data-v=t]"); pg.wait_for_timeout(400); shot("#lab-dyn .charts", "08c_dyn_naveasy_T")
                pg.click("#lab-res .seg [data-v=nav_hard]"); pg.wait_for_timeout(400); shot("#lab-res", "09b_res_navhard")
                pg.click("#lab-res .seg [data-v=nav_easy]"); pg.wait_for_timeout(400); shot("#lab-res .charts", "09c_res_naveasy")
                box = pg.query_selector("#abl-chart svg rect[role=img]").bounding_box(); pg.mouse.move(box["x"] + 5, box["y"] + 5); pg.wait_for_timeout(200); print("  abl tooltip:", pg.inner_text("#abl-chart .tip").replace("\n", " | ")[:160])
                box = pg.query_selector_all("#gen-charts svg rect[role=img]")[7].bounding_box(); pg.mouse.move(box["x"] + box["width"] * 0.6, box["y"] + 5); pg.wait_for_timeout(200); print("  gen tooltip:", pg.inner_text("#gen-charts .tip").replace("\n", " | ")[:160])
                # anatomy follows the lineage selection
                before = pg.inner_text("#anat-balrog .an-head")[:60]
                pg.query_selector_all("#chart-balrog rect[role=button]")[7].click(); pg.wait_for_timeout(400); after = pg.inner_text("#anat-balrog .an-head")[:60]
                print("  anatomy before:", before, "| after click #7:", after); shot("#anat-balrog", "14_anatomy_r35")
                pg.query_selector_all("#chart-balrog rect[role=button]")[40].click(); pg.wait_for_timeout(300); shot("#anat-balrog", "14b_anatomy_best")
                pg.click("#tab-evo-games"); pg.wait_for_timeout(500); shot("#evo-games", "13b_evo_games")
                pg.click("#tab-evo-nav-easy"); pg.wait_for_timeout(500); shot("#evo-nav-easy", "13c_evo_nav_easy")
                pg.click("#tab-evo-nav-hard"); pg.wait_for_timeout(500); shot("#evo-nav-hard", "13d_evo_nav_hard")
                # theme toggle
                pg.click("[data-theme-toggle]"); pg.wait_for_timeout(300); print("  theme after toggle:", pg.evaluate("document.documentElement.getAttribute('data-theme')"), "| bg:", pg.evaluate("getComputedStyle(document.body).backgroundColor")); shot("header.hero", "01b_hero_toggled")
                pg.click("[data-theme-toggle]"); pg.wait_for_timeout(200); print("  theme after second toggle:", pg.evaluate("document.documentElement.getAttribute('data-theme')"))
            print("  console:", logs or "clean")
            pg.close()
        b.close()
finally:
    srv.terminate()
