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
   page.get_by_role('button',name='● Record bass').click()
   expect(page.get_by_role('status')).to_contain_text('User denied microphone permission',timeout=10000)
   expect(page.get_by_role('button',name='● Record bass')).to_be_enabled()
   # Never create a fake audio recording on failed permission.
   assert page.get_by_label('Your take musical features').count()==0
   uploader=page.locator('input[type=file]').nth(1)
   uploader.set_input_files({"name":"unsafe.exe","mimeType":"application/octet-stream","buffer":b'untrusted'})
   expect(page.get_by_role('status')).to_contain_text('supported audio file',timeout=5000)
   expect(page.get_by_role('button',name='● Record bass')).to_be_enabled()
   print('PASS: denied permission recovers; unsupported file cannot enter analysis')
  finally:
   browser.close()
if __name__=='__main__':run()
