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
        for width, tag, dark in [(1680, "wide", False), (1280, "desk", False), (390, "phone", False), (1280, "dark", True)]:
            pg = b.new_page(viewport={"width": width, "height": 950}); logs = []
            if dark: pg.emulate_media(color_scheme="dark")
            pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}")); pg.on("console", lambda m: logs.append(m.text[:120]) if m.type == "error" and "harness-map.pdf" not in m.text else None)
            pg.goto("http://127.0.0.1:8778/index.html", wait_until="networkidle"); pg.wait_for_timeout(1200)
            print(tag, "hscroll:", pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"), "| katex nodes:", pg.evaluate("document.querySelectorAll('.katex').length"), "| sidetoc visible:", pg.evaluate("getComputedStyle(document.querySelector('.sidetoc')).display"), "| teaser px:", pg.evaluate("Math.round(document.querySelector('.teaser-svg').getBoundingClientRect().width)"), "| errors:", logs or "none")
            if tag == "wide":
                pg.evaluate("window.scrollTo(0, document.querySelector('#lab-loop').offsetTop)"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/wide_viewport_loop.png")
                continue
            pg.add_style_tag(content=".topnav{position:static!important}")
            shots = [("#idea", "idea"), (".overview", "overview"), ("#lab-factor", "factor"), ("#lab-loop", "loop"), ("#lab-adapt", "adapt"), ("#results .section-heading, #res-table1", "res_head"), ("#lab-dyn", "dyn"), ("#cases", "cases")] if tag != "phone" else [("#idea", "idea"), ("#lab-factor", "factor"), ("#cases .case-block", "case1")]
            for sel, name in shots:
                e = pg.query_selector(sel)
                if not e: print("  missing", sel); continue
                e.scroll_into_view_if_needed(); pg.wait_for_timeout(250); e.screenshot(path=f"{OUT}/{tag}_{name}.png")
            pg.close()
        b.close()
finally:
    srv.terminate()
