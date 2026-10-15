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
   expect(page_allowed.get_by_role('region',name='Your take audio').get_by_role('button',name='Analyze again')).to_be_visible(timeout=30000)
   expect(page_allowed.locator('p.status')).to_contain_text('Your musical shape is ready.',timeout=30000)
   expect(page_allowed.get_by_role('region',name='Your take audio').locator('small')).to_contain_text('audio/wav')
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
  finally:
   browser.close()
if __name__=='__main__':run()
