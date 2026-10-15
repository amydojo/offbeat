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
   uploader=page.locator('input[type=file]').nth(1)
   uploader.set_input_files({"name":"unsafe.exe","mimeType":"application/octet-stream","buffer":b'untrusted'})
   expect(page.locator('p.status')).to_contain_text('supported audio file',timeout=5000)
   expect(page.get_by_role('button',name='● Record or hum')).to_be_enabled()
   print('PASS: denied permission recovers; unsupported file cannot enter analysis')
   # On a separate emulated phone where microphone is allowed, record actual
   # browser MediaRecorder bytes, stop them and analyze with the new Worker.
   context_allowed=browser.new_context(
    viewport={"width":390,"height":844},is_mobile=True,has_touch=True,permissions=['microphone']
   )
   page_allowed=context_allowed.new_page()
   page_allowed.goto('http://127.0.0.1:5173/',wait_until='networkidle')
   page_allowed.get_by_role('button',name='● Record or hum').click()
   expect(page_allowed.get_by_role('button',name='■ Stop recording')).to_be_enabled(timeout=10000)
   page_allowed.wait_for_timeout(1200)
   page_allowed.get_by_role('button',name='■ Stop recording').click()
   expect(page_allowed.get_by_role('button',name='Analyze shape')).to_be_visible(timeout=12000)
   page_allowed.get_by_role('button',name='Analyze shape').click()
   expect(page_allowed.get_by_role('button',name='Analyze again')).to_be_visible(timeout=30000)
   print('PASS: emulated phone records via MediaRecorder, stops and analyzes locally')
  finally:
   browser.close()
if __name__=='__main__':run()
