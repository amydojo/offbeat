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
   for viewport_width in [320,360,390,430]:
    page.set_viewport_size({"width":viewport_width,"height":844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),f'Horizontal mobile overflow at {viewport_width}px'
    assert page.evaluate("""() => [...document.querySelectorAll('.capture-mode button,.mobile-nav a,.capture-panel .button-record')].every(el => el.getBoundingClientRect().height >= 44)"""),'Mobile tap targets under 44px'
   page.set_viewport_size({"width":390,"height":844})
   expect(page.get_by_role('heading',name='Start with a sound.')).to_be_visible()
   expect(page.get_by_role('button',name='Record or hum')).to_be_visible()
   assert page.evaluate("""() => {
     const record=document.querySelector('.capture-panel .button-record');
     const take=document.getElementById('take');
     const ref=document.getElementById('reference');
     return record.getBoundingClientRect().top < take.getBoundingClientRect().top &&
       take.getBoundingClientRect().top < ref.getBoundingClientRect().top &&
       record.getBoundingClientRect().height >= 48;
   }"""),'Capture must be above the import lanes with a large record target'
   reference_file=page.get_by_role('region',name='Reference audio').locator('input[type=file]')
   take_file=page.get_by_role('region',name='Your take audio').locator('input[type=file]')
   reference_file.set_input_files({"name":"reference.wav","mimeType":"audio/wav","buffer":synthetic_bass()})
   take_file.set_input_files({"name":"humming.wav","mimeType":"audio/wav","buffer":synthetic_bass(1.15)})
   page.get_by_label('Your take source type').select_option('humming')
   page.get_by_role('button',name='Analyze shape').first.click()
   expect(page.get_by_role('button',name='Analyze again')).to_have_count(1,timeout=45000)
   expect(page.get_by_role('link',name='Keep this idea')).to_be_visible()
   expect(page.get_by_role('link',name='Download original')).to_have_count(2)
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
   page.once('dialog',lambda dialog:dialog.accept())
   page.get_by_role('button',name='Delete',exact=True).click()
   expect(page.get_by_text('Pocket groove',exact=True)).to_have_count(0)
   assert all(':8765' not in url for url in calls),'Browser analysis must never depend on Python API'
   assert all(url.startswith(('http://127.0.0.1:5173/','blob:http://127.0.0.1:5173/')) for url in calls),'Unexpected external request: '+str(calls)
   print('PASS: mobile viewport, browser DSP, comparison, A/B, IndexedDB, zero audio network')
  finally:browser.close()
if __name__=='__main__':run()
