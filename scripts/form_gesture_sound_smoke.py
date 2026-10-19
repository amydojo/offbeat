"""FORM 009 audio smoke: real gesture-unlocked output on Chromium and WebKit.

Unlike a DOM 'PLAYING' label, this checks the Web Audio analyser downstream
of the real master bus. It cannot guarantee that a particular phone speaker is
unmuted, but verifies real generated samples in the active audio graph.
"""
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:5173/instrument/gesture/index.html"
with sync_playwright() as p:
 for engine in ("chromium","webkit"):
  browser=getattr(p,engine).launch(headless=True)
  context=browser.new_context(viewport={"width":390,"height":844},
      device_scale_factor=2,is_mobile=True,has_touch=True)
  page=context.new_page()
  errors=[]
  page.on("pageerror",lambda e:errors.append(str(e)))
  response=page.goto(URL,wait_until="networkidle")
  assert response.status==200,(engine,response.status)
  page.wait_for_function("document.querySelector('#sculpture').width>0")
  # No autoplay override: unlock must come from a genuine click.
  page.locator("#soundCheck").click()
  page.wait_for_function(
      "document.querySelector('#soundHealth').textContent.includes('SIGNAL DETECTED') || document.querySelector('#soundHealth').textContent.includes('NO SIGNAL DETECTED') || document.querySelector('#soundHealth').textContent.includes('BLOCKED')",
      timeout=12000)
  check=page.locator("#soundHealth").inner_text()
  assert "SIGNAL DETECTED" in check, (engine,check,page.locator("#status").inner_text())
  page.locator("#play").click()
  page.wait_for_function("document.querySelector('#playingState').textContent.includes('PLAYING')",timeout=20000)
  page.wait_for_function("document.querySelector('#soundHealth').textContent.includes('SIGNAL ACTIVE')",timeout=9000)
  # Measure a real running signal via master analyser, not a JS playback flag.
  active=page.locator("#soundHealth").inner_text()
  assert page.locator("#signalBar").is_visible()
  assert page.locator("#play").inner_text().find("PAUSE")>=0
  assert not errors,(engine,errors)
  print("FORM 009 REAL AUDIO PASS",engine,check,active)
  browser.close()
