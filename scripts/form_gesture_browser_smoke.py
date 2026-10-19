"""FORM 009 physical gesture regression on an iPhone-size Chromium viewport."""
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:5173/instrument/gesture/index.html"
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--autoplay-policy=no-user-gesture-required"])
 context=browser.new_context(viewport={"width":390,"height":844},
    device_scale_factor=2,is_mobile=True,has_touch=True)
 page=context.new_page()
 errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 response=page.goto(BASE,wait_until="networkidle")
 assert response.status==200,response.status
 assert "FORM 009" in page.title()
 page.wait_for_function("document.querySelector('#sculpture').width>0")
 assert page.locator("#sculpture").is_visible()
 assert page.evaluate("document.scrollingElement.scrollWidth<=innerWidth+3")
 assert page.locator("#undo").is_disabled()

 # Starter audio unlock, locally sampled bass, and continuous groove.
 page.locator("#play").click()
 page.wait_for_function("document.querySelector('#playingState').textContent.includes('PLAYING')",timeout=20000)
 assert page.evaluate("window.OffbeatStudioBass&&window.OffbeatRhythm")
 assert page.locator("#play").inner_text().find("PAUSE")>=0

 # Single pull controls pitch + duration + attack energy; all derived from
 # the same physical action and recorded as reversible musical intent.
 box=page.locator("#sculpture").bounding_box()
 x=box["x"]+box["width"]*.53
 y=box["y"]+box["height"]*.52
 page.mouse.move(x,y);page.mouse.down()
 page.mouse.move(x+85,y-93,steps=12)
 assert page.locator("#tension").inner_text()!="00"
 assert "is-held" in (page.locator("#stage").get_attribute("class") or "")
 page.mouse.up()
 page.wait_for_function("document.querySelector('#gestureList button')!==null")
 assert page.locator("#undo").is_enabled()
 assert page.locator("#original").is_enabled()
 assert page.locator("#beforeAfter").is_enabled()
 assert "is-held" not in (page.locator("#stage").get_attribute("class") or "")
 assert page.locator("#gestureList button").count()==1
 assert page.locator("#bassResponse").inner_text() not in ("THE FOUNDATION","STILL")
 assert page.locator("#harmonyResponse").inner_text() in ("MOVED WITH YOU","HELD ITS PLACE")
 assert page.locator("#rhythmResponse").inner_text() in ("NEW ACCENT","PULSE HOLDS")
 assert page.locator("#queued").is_visible()

 # A focused musical A/B is not just a decorative button.
 page.locator("#beforeAfter").click()
 assert "ORIGINAL" in page.locator("#beforeAfter").inner_text()
 page.wait_for_timeout(1750)

 # Saved gesture comes back as the musical frame and its physical trace.
 page.reload(wait_until="networkidle")
 page.wait_for_function("document.querySelector('#sculpture').width>0")
 assert page.locator("#gestureList button").count()>=1
 assert page.locator("#reset").is_enabled()
 assert page.evaluate("document.scrollingElement.scrollWidth<=innerWidth+3")
 page.locator("#gestureList button").first.click()
 assert page.locator("#undo").is_enabled()

 # Original-versus-variation compiles different bass and relational sound.
 assert page.evaluate("""async()=>{
   const v=await import('/instrument/gesture/physics.mjs');
   const c=await import('/instrument/frame/core.mjs');
   const before=c.starter();
   const after=v.applyGesture(before,v.sampleGesture({originX:.49,dx:120,dy:-90,elapsed:180,travel:1.5}),'b4');
   const a=v.compilePhysical(before),b=v.compilePhysical(after);
   return a.bass.find(x=>x.sourceId==='b4').frequency!==b.bass.find(x=>x.sourceId==='b4').frequency
     && a.harmony.find(x=>x.sourceId==='b4').frequency!==b.harmony.find(x=>x.sourceId==='b4').frequency
     && b.physicalResponses.length>0;
 }""")

 # Change pulse/harmony/feel without losing the original gesture.
 page.locator("#more summary").click()
 page.locator("#keepHarmony").uncheck()
 assert not page.locator("#keepHarmony").is_checked()
 page.locator("#save").click()
 assert page.locator("#saved button").count()>=1

 # WAV needs actual rendered PCM sample/drums, not a fake download.
 exported=page.evaluate("""async()=>{
  const core=await import('/instrument/frame/core.mjs');
  const sound=await import('/instrument/frame/audio.mjs');
  const musical=await import('/instrument/gesture/physics.mjs');
  const blob=await new sound.FrameAudio().exportWav(musical.compilePhysical(core.starter()));
  const b=new Uint8Array(await blob.arrayBuffer());
  return {header:String.fromCharCode(...b.slice(0,4)),bytes:b.length};
 }""")
 assert exported["header"]=="RIFF" and exported["bytes"]>40000,exported

 page.set_viewport_size({"width":320,"height":700})
 page.wait_for_timeout(100)
 assert page.evaluate("document.scrollingElement.scrollWidth<=innerWidth+3"),"Horizontal scroll on 320px phone"
 assert page.locator("#sculpture").is_visible()
 assert not errors,errors
 print("FORM 009 physical mobile/gesture/audio/WAV PASS",exported)
 browser.close()
