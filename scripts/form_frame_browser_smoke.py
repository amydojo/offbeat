"""FORM 007 functional regression in real headless Chromium, emulating an iPhone."""
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:5173/instrument/frame/index.html"
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--autoplay-policy=no-user-gesture-required"])
    context=browser.new_context(
        viewport={"width":390,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True
    )
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    resp=page.goto(URL,wait_until="networkidle")
    assert resp.status==200,f"FORM 007 route not found: {resp.status}"
    page.wait_for_function("document.querySelector('#shape .bass-line')!==null")
    assert "FORM 007" in page.title()
    assert page.locator("#transport").is_enabled()
    assert page.locator("#original").is_disabled()
    assert page.locator("#compareOriginal").is_disabled()
    assert page.locator("#shape .bass-line").count()>0
    style=page.locator("#shape .bass-line").first.evaluate(
        "(el)=>getComputedStyle(el).strokeWidth")
    assert style!="0px",f"Bass contour invisible: {style}"
    initial=page.locator("#shape .bass-line").first.get_attribute("d")

    # Audio starts with ONE real user gesture, loads real samples and loops.
    page.locator("#transport").click()
    page.wait_for_function("document.querySelector('#playingLabel').textContent.includes('MOVING')",timeout=15000)
    assert page.locator("#transport").inner_text().find("PAUSE")>=0
    assert page.evaluate("window.OffbeatStudioBass&&window.OffbeatRhythm")
    assert page.evaluate("document.scrollingElement.scrollWidth<=innerWidth+3"),"Page scrolls horizontally"

    # A single guided click changes authored bass, visual contour and a
    # supporting harmonic event (assert the actual compiled musical data).
    baseline=page.evaluate("""async()=> {
       const mod=await import('/instrument/frame/core.mjs');
       const frame=mod.starter(),events=mod.compileFrame(frame);
       const f=mod.update(frame,'b4',{height:.97}),next=mod.compileFrame(f);
       return {
         original:events.bass.find(x=>x.sourceId==='b4').frequency,
         changed:next.bass.find(x=>x.sourceId==='b4').frequency,
         originalHarmony:events.harmony.find(x=>x.sourceId==='b4').frequency,
         changedHarmony:next.harmony.find(x=>x.sourceId==='b4').frequency,
         originalDrums:events.drums.filter(x=>x.reason==='pulse').map(x=>x.time),
         changedDrums:next.drums.filter(x=>x.reason==='pulse').map(x=>x.time)
       }
    }""")
    assert baseline["original"]!=baseline["changed"],baseline
    assert baseline["originalHarmony"]!=baseline["changedHarmony"],baseline
    assert baseline["originalDrums"]==baseline["changedDrums"],baseline
    page.locator("#higher").click()
    altered=page.locator("#shape .bass-line").first.get_attribute("d")
    assert initial!=altered,"Moving a note did not alter the contour"
    assert page.locator("#compareOriginal").is_enabled()
    page.locator("#compareOriginal").click()
    assert page.locator("#shape .bass-line").first.get_attribute("d")==initial
    page.locator("#compareYours").click()
    assert page.locator("#shape .bass-line").first.get_attribute("d")==altered

    # Drag selected note in the main touch interface.
    canvas=page.locator("#shape")
    box=canvas.bounding_box()
    x=box["x"]+box["width"]*(42+3.5*77)/700
    y=box["y"]+box["height"]*(233-.93*165)/382 # approx updated selected point
    page.mouse.move(x,y)
    page.mouse.down()
    page.mouse.move(x,y+22,steps=6)
    page.mouse.up()
    assert page.locator("#undo").is_enabled()

    # Empty space and active constraint controls should materially affect state.
    page.locator("#space").click()
    assert page.locator("#space").inner_text().find("RESTORE")>=0
    page.locator("#space").click()
    assert page.locator("#space").inner_text().find("LEAVE")>=0
    page.locator("#lockHarmony").click()
    assert page.locator("#lockHarmony").get_attribute("aria-pressed")=="false"
    page.locator("#lockPulse").click()
    assert page.locator("#lockPulse").get_attribute("aria-pressed")=="false"
    page.locator("#undo").click()
    assert page.locator("#redo").is_enabled()

    # WAVE export is real OfflineAudioContext with sample decoding and drum mix.
    exported=page.evaluate("""async()=>{
      const core=await import('/instrument/frame/core.mjs');
      const audio=await import('/instrument/frame/audio.mjs');
      const engine=new audio.FrameAudio();
      const blob=await engine.exportWav(core.compileFrame(core.starter()));
      const bytes=new Uint8Array(await blob.arrayBuffer());
      return {length:bytes.length,head:String.fromCharCode(...bytes.slice(0,4)),type:blob.type}
    }""")
    assert exported["head"]=="RIFF" and exported["length"]>40000,exported
    page.locator("#transport").click()
    assert "START" in page.locator("#transport").inner_text() or "HEAR" in page.locator("#transport").inner_text()

    # A saved musical possibility survives reload, not just the current DOM.
    page.locator("#more summary").click()
    page.locator("#keep").click()
    assert page.locator("#saved button").count() >= 1
    page.reload(wait_until="networkidle")
    page.wait_for_function("document.querySelector('#shape .bass-line')!==null")
    assert page.locator("#saved button").count() >= 1
    page.locator("#more summary").click()  # details returns closed after reload
    page.locator("#saved button").first.click()
    assert page.locator("#compareOriginal").is_enabled()

    # Tight mobile screen remains editable and readable.
    page.set_viewport_size({"width":320,"height":700})
    page.wait_for_timeout(100)
    assert page.evaluate("document.scrollingElement.scrollWidth<=innerWidth+3")
    assert page.locator("#higher").is_visible()
    assert not errors,f"Runtime JavaScript errors: {errors}"
    print("FORM 007 browser journey PASS",baseline,exported)
    browser.close()
