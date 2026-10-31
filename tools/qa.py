import sys, os, glob, subprocess, time
S = "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad"
sys.path.insert(0, f"{S}/pylib"); os.environ["PLAYWRIGHT_BROWSERS_PATH"] = f"{S}/pw"; os.environ["LD_LIBRARY_PATH"] = f"{S}/deb/ex/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
SITE = "/home/azureuser/workspace/harness-evolution.github.io"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1", "-d", SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
exe = glob.glob(f"{S}/pw/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")[0]
OUT = f"{S}/shots"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox", "--disable-gpu"])
        pg = b.new_page(viewport={"width": 1280, "height": 950}); logs = []
        pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}")); pg.on("console", lambda m: logs.append(m.text[:140]) if m.type == "error" and "harness-map.pdf" not in m.text else None)
        pg.goto("http://127.0.0.1:8765/index.html", wait_until="networkidle"); pg.wait_for_timeout(1200)
        print("sidetoc display @1280:", pg.evaluate("getComputedStyle(document.querySelector('.sidetoc')).display"), "| errors:", logs or "none")
        pg.evaluate("window.scrollTo(0, document.querySelector('#lab-res').offsetTop - 60)"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/viewport_res_with_toc.png")
        pg.add_style_tag(content=".topnav{position:static!important}.sidetoc{display:none!important}")
        def shot(sel, name):
            e = pg.query_selector(sel)
            if not e: print("  missing", sel); return
            e.scroll_into_view_if_needed(); pg.wait_for_timeout(250); e.screenshot(path=f"{OUT}/{name}.png")
        shot("#idea", "idea"); pg.click("details.abstract summary"); pg.wait_for_timeout(300); shot("details.abstract", "abstract_open")
        shot("#lab-factor", "factor"); shot("#lab-loop", "loop"); shot("#lab-res", "res_games"); shot("#lab-abl", "abl"); shot("#lab-gen", "gen")
        pg.click("#lab-res .seg [data-v=balrog]"); pg.wait_for_timeout(400); shot("#lab-res .charts", "res_balrog")
        pg.click("#lab-res .seg [data-v=nav]"); pg.wait_for_timeout(400); shot("#lab-res", "res_nav")
        pg.click("#lab-dyn [data-ctl=view] [data-v=per]"); pg.wait_for_timeout(500); shot("#lab-dyn .charts", "dyn_pergame")
        shot("#evo-balrog .showcase", "evo_balrog")
        pg.click("#tab-evo-nav-hard"); pg.wait_for_timeout(500); shot("#anat-nav", "anat_nav")
        # lightbox
        pg.click("#lab-res .charts .chart:first-child .zoom-btn"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/lightbox.png"); print("lightbox on:", pg.evaluate("document.querySelector('#lightbox').classList.contains('on')"))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200); print("lightbox after Esc:", pg.evaluate("document.querySelector('#lightbox').classList.contains('on')"))
        pg.click("#lab-gen .charts-tools button"); pg.wait_for_timeout(600); pg.screenshot(path=f"{OUT}/lightbox_gen_all.png"); pg.keyboard.press("Escape")
        print("errors:", logs or "none")
        pg.close()
        for width in (360, 480, 768, 1100, 1680):
            pg = b.new_page(viewport={"width": width, "height": 900}); pg.goto("http://127.0.0.1:8765/index.html", wait_until="networkidle"); pg.wait_for_timeout(600)
            print(width, "hscroll:", pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"), "| toc:", pg.evaluate("getComputedStyle(document.querySelector('.sidetoc')).display"))
            if width == 360: pg.add_style_tag(content=".topnav{position:static!important}"); e = pg.query_selector("#lab-res"); e.scroll_into_view_if_needed(); pg.wait_for_timeout(200); e.screenshot(path=f"{OUT}/phone_res.png")
            pg.close()
        b.close()
finally:
    srv.terminate()
