"""Emulated phone failure states: denied mic, bad audio, and recovery.
No claim of physical iOS Safari compatibility; only synthetic Chromium.
"""
from playwright.sync_api import sync_playwright, expect
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=[
   "--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"
  ])
  try:
   context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
   page=context.new_page()
   page.add_init_script("""
     Object.defineProperty(navigator.mediaDevices,'getUserMedia',{
       configurable:true,value:async()=>{const error=new Error('User denied microphone permission');error.name='NotAllowedError';throw error;}
     });
   """)
   page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
   page.get_by_role('button',name='● Record or hum').click()
   expect(page.locator('p.status')).to_contain_text('Microphone access was denied.',timeout=10000)
   expect(page.get_by_role('button',name='● Record or hum')).to_be_enabled()
   # Never create a fake audio recording on failed permission.
   assert page.get_by_label('Your take musical features').count()==0
   uploader=page.get_by_role('region',name='Your take audio').locator('input[type=file]')
   uploader.set_input_files({"name":"unsafe.exe","mimeType":"application/octet-stream","buffer":b'untrusted'})
   expect(page.locator('p.status')).to_contain_text('supported audio file',timeout=5000)
   expect(page.get_by_role('button',name='● Record or hum')).to_be_enabled()
   print('PASS: denied permission recovers; unsupported file cannot enter analysis')
   # On a separate emulated phone where microphone is allowed, record actual
   # browser PCM/WAV bytes, stop them and analyze with the Worker.
   context_allowed=browser.new_context(
    viewport={"width":390,"height":844},is_mobile=True,has_touch=True,permissions=['microphone']
   )
   # A browser with no MediaRecorder must still capture real, decodable WAV.
   context_allowed.add_init_script("Object.defineProperty(window, 'MediaRecorder', {configurable:true, value:undefined})")
   page_allowed=context_allowed.new_page()
   page_allowed.goto('http://127.0.0.1:5173/',wait_until='networkidle')
   page_allowed.get_by_role('button',name='● Record or hum').click()
   expect(page_allowed.get_by_role('button',name='■ Stop recording')).to_be_enabled(timeout=10000)
   page_allowed.wait_for_timeout(1200)
   page_allowed.get_by_role('button',name='■ Stop recording').click()
   expect(page_allowed.get_by_role('region',name='Your take audio').locator('.clip-done')).to_be_visible(timeout=60000)
   page_allowed.get_by_role('region',name='Your take audio').locator('details.clip-details').last.locator('summary').click()
   with page_allowed.expect_download() as wav_download:
    page_allowed.get_by_role('link',name='Download original').click()
   from pathlib import Path
   wav=Path(wav_download.value.path()).read_bytes()
   assert wav[:4]==b'RIFF' and wav[8:12]==b'WAVE' and wav[20:22]==bytes([1, 0])
   assert len(wav)>10000, 'Microphone recording must contain meaningful PCM audio'
   # The exact generated WAV must round-trip through the browser decoder.
   is_decodable=page_allowed.evaluate("""async () => {
     const src=document.querySelector('#take audio')?.src;
     if(!src)return false;
     const bytes=await (await fetch(src)).arrayBuffer();
     const ctx=new (window.AudioContext||window.webkitAudioContext)();
     try { const decoded=await ctx.decodeAudioData(bytes); return decoded.length>1000; }
     finally { await ctx.close(); }
   }""")
   assert is_decodable, 'Browser recorded WAV must decode via AudioContext'

   print('PASS: emulated phone records valid PCM/WAV without MediaRecorder, stops and analyzes locally')

   # Reproduce the iPhone symptom: a ~2-minute file is playable, but the
   # module worker fails to initialize. OFFBEAT must complete on-device.
   from browser_smoke import synthetic_bass
   import json, subprocess, tempfile
   from pathlib import Path
   raw=synthetic_bass(41.5)  # 124.5-second source, within 25 MB
   with tempfile.TemporaryDirectory() as tmp:
    input_path=Path(tmp)/'source.wav'
    encoded_path=Path(tmp)/'source.m4a'
    input_path.write_bytes(raw)
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(input_path),
                    '-c:a','aac','-b:a','96k',str(encoded_path)],check=True)
    m4a=encoded_path.read_bytes()

   broken_worker=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
   broken_worker.add_init_script("""
     Object.defineProperty(window,'Worker',{configurable:true,
       value:class {constructor(){throw new Error('Simulated Safari worker creation failure')}}});
   """)
   fallback_page=broken_worker.new_page()
   fallback_page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
   supports_aac=fallback_page.evaluate("""() =>
     !!document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"')""")
   sample={"name":"bass-long.m4a","mimeType":"audio/x-m4a","buffer":m4a} if supports_aac else \
          {"name":"bass-long.wav","mimeType":"audio/wav","buffer":raw}
   lane=fallback_page.get_by_role('region',name='Your take audio')
   lane.locator('input[type=file]').set_input_files(sample)
   # Native metadata must make this slider available BEFORE any analysis.
   lane.locator('details.clip-details').first.locator('summary').click()
   slider=fallback_page.get_by_role('slider',name='Your take analysis excerpt position')
   expect(slider).to_be_visible(timeout=20000)
   expect(lane.locator('.clip-done')).to_be_visible(timeout=120000)
   slider.fill('65')
   lane.get_by_role('button',name='Analyze shape').click()
   expect(lane.locator('.clip-done')).to_be_visible(timeout=120000)
   expect(fallback_page.locator('p.status')).to_contain_text('Analyzed 55 seconds',timeout=120000)
   lane.locator('details.clip-details').last.locator('summary').click()
   expect(lane.get_by_label('Your take musical features')).to_be_visible()
   fallback_page.get_by_placeholder('That riff with the long pause').fill('Worker fallback phrase')
   fallback_page.get_by_role('button',name='Keep this phrase').click()
   fallback_page.locator('details.saved-drawer > summary').click()
   expect(fallback_page.get_by_text('Worker fallback phrase',exact=True)).to_be_visible(timeout=20000)
   with fallback_page.expect_download() as backup_download:
    fallback_page.get_by_role('button',name='Export project').click()
   manifest=json.loads(Path(backup_download.value.path()).read_bytes())
   audio=manifest['session']['take']
   assert abs(audio['excerpt_start_s']-65)<.2
   assert audio['full_duration_s']>120
   assert 54.9<=audio['analysis']['source']['duration_s']<=55.01
   assert 'worker_fallback_main_thread' in audio['analysis']['quality_flags']
   print('PASS: >2min AAC/WAV upload, pre-analysis slider, worker failure fallback, local saved analysis')

  finally:
   browser.close()
if __name__=='__main__':run()
