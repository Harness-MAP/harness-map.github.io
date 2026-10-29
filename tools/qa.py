import sys, os, glob, subprocess, time
S = "/tmp/claude-1000/-home-azureuser/8e7565d1-6529-493a-a528-66b753c0583c/scratchpad"
sys.path.insert(0, f"{S}/pylib")
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = f"{S}/pw"
os.environ["LD_LIBRARY_PATH"] = f"{S}/deb/ex/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
SITE = "/home/azureuser/workspace/harness-evolution.github.io"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8767", "--bind", "127.0.0.1", "-d", SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
exe = glob.glob(f"{S}/pw/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")[0]
OUT = f"{S}/shots2"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox", "--disable-gpu"])
        def session(width, tag, dark=False):
            pg = b.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
            if dark: pg.emulate_media(color_scheme="dark")
            logs = []
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
            pg.goto("http://127.0.0.1:8767/index.html", wait_until="networkidle"); pg.wait_for_timeout(1200)
            def shot(sel, name):
                el = pg.query_selector(sel)
                if not el: print("  missing", sel); return
                el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); el.screenshot(path=f"{OUT}/{tag}_{name}.png")
            print(tag, "height", pg.evaluate("document.documentElement.scrollHeight"), "| hscroll:", pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"))
            return pg, shot, logs
        for width, tag, dark in [(1280, "desk", False), (390, "phone", False), (1280, "dark", True)]:
            pg, shot, logs = session(width, tag, dark)
            shot("header.hero", "01_hero"); shot("#idea", "02_idea"); shot(".steps3", "03_steps"); shot("#lab-factor", "04_factor"); shot("#lab-loop", "05_loop"); shot("#lab-adapt", "06_adapt")
            shot("#barcards", "07_table1"); shot("#lab-dyn", "08_dyn"); shot("#lab-res", "09_res")
            if tag == "desk":
                pg.click("#lab-factor .cand-tabs button:nth-child(4)"); pg.wait_for_timeout(200); shot("#lab-factor", "04b_factor_d")
                pg.click("#lab-factor .cand-tabs button:nth-child(1)"); pg.wait_for_timeout(200); shot("#lab-factor .factor-grid", "04c_factor_a")
                pg.click("#lab-dyn [data-ctl=view] [data-v=per]"); pg.wait_for_timeout(400); shot("#lab-dyn", "08b_dyn_pergame")
                pg.click("#lab-dyn [data-ctl=bench] [data-v=balrog]"); pg.wait_for_timeout(400); shot("#lab-dyn", "08c_dyn_balrog_pertask")
                pg.click("#lab-dyn [data-ctl=view] [data-v=agg]"); pg.click("#lab-dyn [data-ctl=axis] [data-v=t]"); pg.wait_for_timeout(400); shot("#lab-dyn", "08d_dyn_balrog_T")
                pg.click("#lab-dyn [data-ctl=mode] [data-v=hier]"); pg.wait_for_timeout(300)
                # legend toggle + slider + hover
                pg.click("#lab-dyn .legend-toggles button:nth-of-type(6)"); pg.wait_for_timeout(300)
                pg.evaluate("const s=document.querySelector('#lab-dyn [data-slider]'); s.value=5; s.dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
                print("  readout after slider:", pg.inner_text("#lab-dyn [data-readout]"))
                box = pg.query_selector("#lab-dyn .chart svg").bounding_box(); pg.mouse.move(box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.5); pg.wait_for_timeout(200)
                print("  tooltip:", pg.inner_text("#lab-dyn .chart .tip").replace("\n", " | ")[:200]); shot("#lab-dyn", "08e_dyn_hover_reveal")
                pg.click("#lab-dyn [data-play]"); pg.wait_for_timeout(1500); print("  play readout mid-way:", pg.inner_text("#lab-dyn [data-readout]")); pg.wait_for_timeout(7000); print("  play readout end:", pg.inner_text("#lab-dyn [data-readout]"))
                pg.click("#lab-res .seg [data-v=balrog]"); pg.wait_for_timeout(400); shot("#lab-res", "09b_res_balrog")
                box = pg.query_selector("#lab-res .chart svg").bounding_box(); pg.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5); pg.wait_for_timeout(200)
                print("  res tooltip:", pg.inner_text("#lab-res .chart .tip").replace("\n", " | ")[:200])
                pg.click("#lab-res .legend-toggles button:nth-of-type(2)"); pg.wait_for_timeout(300); shot("#lab-res", "09c_res_balrog_nofixed")
                pg.click("details.numeric summary"); pg.wait_for_timeout(300); shot("details.numeric", "07b_table1_numeric")
                pg.click("details.abstract summary"); pg.wait_for_timeout(300); shot("details.abstract", "02b_abstract_open")
            shot("#evolution", "10_evolution"); shot("#bibtex", "11_bibtex"); shot("footer", "12_footer")
            print("  paper button class:", pg.get_attribute("#btn-paper", "class"))
            print("  console:", logs or "clean")
            pg.close()
        b.close()
finally:
    srv.terminate()
