"""Phone-sized browser journey with local DSP only. No Python requests or cloud audio."""
from playwright.sync_api import sync_playwright, expect
from browser_smoke import synthetic_bass

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=[
   "--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream",
   "--autoplay-policy=no-user-gesture-required"
  ])
  try:
   context=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=3,is_mobile=True,has_touch=True,permissions=["microphone"])
   page=context.new_page()
   page.set_default_timeout(30000)
   calls=[]
   page.on('request',lambda request:calls.append(request.url))
   page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
   expect(page.get_by_role('navigation',name='Offbeat mobile navigation')).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),'Horizontal mobile overflow'
   uploader=page.locator('input[type=file]')
   uploader.nth(0).set_input_files({"name":"reference.wav","mimeType":"audio/wav","buffer":synthetic_bass()})
   uploader.nth(1).set_input_files({"name":"humming.wav","mimeType":"audio/wav","buffer":synthetic_bass(1.15)})
   page.get_by_label('Your take source type').select_option('humming')
   page.get_by_role('button',name='Analyze shape').first.click()
   expect(page.get_by_role('button',name='Analyze again')).to_have_count(1,timeout=45000)
   page.get_by_role('button',name='Analyze shape').click()
   expect(page.get_by_role('button',name='Analyze again')).to_have_count(2,timeout=45000)
   page.get_by_role('button',name='Compare these phrases').click()
   expect(page.get_by_text('temporally corresponding attacks',exact=False)).to_be_visible(timeout=12000)
   page.get_by_role('button',name='A / B · Alternate').click()
   expect(page.get_by_role('button',name='■ Stop')).to_be_enabled()
   page.get_by_role('button',name='■ Stop').click()
   page.get_by_placeholder('That riff with the long pause').fill('Pocket groove')
   page.get_by_role('button',name='Keep this phrase').click()
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible(timeout=12000)
   page.reload(wait_until='networkidle')
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible()
   page.get_by_role('button',name='Open',exact=True).click()
   expect(page.get_by_text('Opened saved originals and analysis.',exact=False)).to_be_visible()
   page.get_by_role('button',name='Delete',exact=True).click()
   expect(page.get_by_text('Pocket groove',exact=True)).to_have_count(0)
   assert all(':8765' not in url for url in calls),'Browser analysis must never depend on Python API'
   assert all(url.startswith(('http://127.0.0.1:5173/','blob:http://127.0.0.1:5173/')) for url in calls),'Unexpected external request: '+str(calls)
   print('PASS: mobile viewport, browser DSP, comparison, A/B, IndexedDB, zero audio network')
  finally:browser.close()
if __name__=='__main__':run()
