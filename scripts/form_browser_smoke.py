"""FORM mobile instrument regression: actual Chromium Web Audio rendering and touch UX."""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/instrument/index.html"  # Vite dev serves public static files by exact filename

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    response = page.goto(BASE, wait_until="networkidle")
    assert response.status == 200, f"FORM failed to load: {response.status}"
    assert page.locator("#bassMode").count() == 1
    assert page.locator("#kick").count() == 1
    assert page.locator("#snare").count() == 1
    assert page.locator("#hat").count() == 1
    assert page.evaluate("typeof window.OffbeatBass==='object'")
    assert page.evaluate("typeof window.OffbeatRhythm==='object'")
    assert page.evaluate("typeof window.OffbeatPluck==='object'")
    assert page.evaluate("Object.keys(window.OffbeatBassSamples).length>=4")

    # Render the actual bass synthesizer offline: no speakers or hardware needed.
    stats = page.evaluate("""async () => {
      const c = new OfflineAudioContext(1, 44100, 44100);
      const m = c.createGain(); m.gain.value = .7; m.connect(c.destination);
      const v = window.OffbeatBass.create(c, m, .01, .38, .42, 'hold', 'warm', 'riff');
      window.OffbeatBass.move(v, .27, .7, .65);
      window.OffbeatBass.stop(v, .64);
      const rendered = await c.startRendering();
      const samples = rendered.getChannelData(0);
      let peak=0, power=0, nonzero=0;
      for(let i=0;i<samples.length;i++) {
        const a = Math.abs(samples[i]);
        peak=Math.max(peak,a); power+=a*a;
        if(a>.00001) nonzero++;
      }
      return {peak,rms:Math.sqrt(power/samples.length),nonzero}
    }""")
    assert stats["rms"] > 0.002, f"Silent bass render: {stats}"
    assert stats["nonzero"] > 8000, f"Too short/silent: {stats}"
    assert stats["peak"] < 1, f"Clipping bass render: {stats}"

    # A string is an impulse-and-decay voice, not an endlessly sustained oscillator.
    plucked = page.evaluate("""async () => {
      const c = new OfflineAudioContext(1, 44100, 44100);
      const ready = await window.OffbeatPluck.preload(c);
      const m = c.createGain();m.gain.value=.72;m.connect(c.destination);
      const v=window.OffbeatPluck.play(c,m,.012,.43,.52,'warm');
      const buf=await c.startRendering(),a=buf.getChannelData(0);
      let peak=0,sum=0,early=0,late=0,nonzero=0;
      for(let i=0;i<a.length;i++){
        const x=Math.abs(a[i]);peak=Math.max(peak,x);sum+=x*x;
        if(i>=.04*44100&&i<.14*44100)early+=x*x;
        if(i>=.6*44100&&i<.72*44100)late+=x*x;
        if(x>.00005)nonzero++;
      }
      return {ready,peak,rms:Math.sqrt(sum/a.length),early,late,nonzero};
    }""")
    assert plucked["rms"] > 0.008, f"Pluck voice too quiet: {plucked}"
    assert plucked["peak"] < 1, f"Pluck voice clips: {plucked}"
    assert plucked["nonzero"] > 6500, f"Pluck voice silent/short: {plucked}"
    assert plucked["early"] > plucked["late"] * 2, f"No pluck decay: {plucked}"
    # Audio gate intentionally covers the instrument until explicitly unlocked.
    page.locator("#unlock").click()
    page.wait_for_function("document.querySelector('#audioGate').hidden", timeout=10000)

    # Confirm PLUCK and optional GLIDE can be switched without scrolling or navigating.
    page.locator("#bassMode").click()
    assert page.locator("#bassMode").inner_text().strip().endswith("GLIDE")
    page.locator("#bassMode").click()
    assert page.locator("#bassMode").inner_text().strip().endswith("PLUCK")
    assert page.evaluate("document.scrollingElement.scrollHeight <= innerHeight + 6"), "Page scrolls when instrument should be locked"
    page.locator("#record").click()
    page.touchscreen.tap(100, 340)
    page.touchscreen.tap(100, 490)
    page.touchscreen.tap(320, 370)
    page.locator("#record").click()
    assert page.locator("#play").is_enabled(), "Capture did not enable replay"
    page.locator("#play").click()
    assert page.locator("#play").inner_text().strip().endswith("STOP")
    page.locator("#play").click()
    assert not errors, f"JS errors: {errors}"
    print("FORM plucked-string audio + mobile controls PASS", stats, plucked)
    browser.close()
