"""Mobile focus journey: two takes -> A/B -> drums -> save/import -> long excerpt.
Chromium emulation, not physical Safari. Raw audio stays local.
"""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
from browser_smoke import synthetic_bass

def ensure_open(page,selector):
 if not page.locator(selector).evaluate('(node)=>node.open'):
  page.locator(selector+' > summary').click()

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=[
   "--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream",
   "--autoplay-policy=no-user-gesture-required"
  ])
  try:
   context=browser.new_context(viewport={"width":390,"height":844},
      device_scale_factor=3,is_mobile=True,has_touch=True,permissions=["microphone"])
   page=context.new_page()
   page.set_default_timeout(40000)
   requests=[]
   page.on('request',lambda request:requests.append(request.url))
   page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
   expect(page.get_by_role('navigation',name='Offbeat mobile navigation')).to_be_visible()
   expect(page.get_by_role('heading',name='Catch what you hear.')).to_be_visible()
   expect(page.get_by_role('button',name='Record or hum')).to_be_visible()
   for width in (320,360,390,430):
    page.set_viewport_size({"width":width,"height":844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),f'Overflow at {width}px'
    assert page.evaluate("""() => [...document.querySelectorAll('.mobile-nav a,.capture-panel .button-record')].every(
      el => el.getBoundingClientRect().height >= 44)"""),'Small touch target'
   page.set_viewport_size({"width":390,"height":844})
   take=page.get_by_role('region',name='Your take audio')
   reference=page.get_by_role('region',name='Reference audio')
   upload_take=take.locator('input[type=file]')
   upload_reference=reference.locator('input[type=file]')
   upload_take.set_input_files({"name":"Bass sesh 2 pluck.wav","mimeType":"audio/wav","buffer":synthetic_bass(1.15)})
   upload_reference.set_input_files({"name":"Bass sesh 2 pick.wav","mimeType":"audio/wav","buffer":synthetic_bass()})
   expect(page.locator('.clip-done')).to_have_count(2,timeout=100000)
   expect(take.get_by_role('heading',name='Pluck')).to_be_visible()
   expect(reference.get_by_role('heading',name='Pick')).to_be_visible()
   assert page.locator('details.compare-drawer').evaluate('(d)=>!d.open'),'Advanced pitch should stay closed'
   assert page.locator('details.feature-drawer').evaluate('(d)=>!d.open'),'Drums should stay closed'
   expect(page.locator('.quick-insight')).to_be_visible(timeout=15000)
   player=page.get_by_role('region',name='Phrase audition')
   player.get_by_role('button',name='Play A / B').click()
   expect(player.get_by_role('button',name='■ Stop')).to_be_enabled()
   player.get_by_role('button',name='■ Stop').click()
   page.locator('details.feature-drawer > summary').click()
   groove=page.get_by_role('region',name='Responsive drummer')
   expect(groove.get_by_role('button',name='Follow')).to_be_visible()
   groove.get_by_role('button',name='Answer').click()
   expect(groove.get_by_role('button',name='Answer')).to_have_attribute('aria-pressed','true')
   groove.get_by_role('button',name='Contrast').click()
   groove.get_by_role('button',name='Follow').click()
   groove.get_by_role('slider',name='Drum density').fill('0.85')
   groove.get_by_role('button',name='New variation').click()
   groove.get_by_role('button',name='Play with drums').click()
   expect(groove.get_by_role('button',name='Stop groove')).to_be_visible(timeout=15000)
   groove.get_by_role('button',name='Stop groove').click()
   with page.expect_download(timeout=30000) as exported:
    groove.get_by_role('button',name='Export mixed WAV').click()
   mixed=Path(exported.value.path()).read_bytes()
   assert mixed[:4]==b'RIFF' and mixed[8:12]==b'WAVE' and len(mixed)>12000
   page.get_by_placeholder('Name this idea…').fill('Pocket groove')
   page.get_by_role('button',name='Keep this phrase').click()
   ensure_open(page,'details.saved-drawer')
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible(timeout=15000)
   with page.expect_download() as exporting:
    page.get_by_role('button',name='Export project').click()
   backup=Path(exporting.value.path()).read_bytes()
   manifest=json.loads(backup)
   assert manifest['schema_version']=='offbeat.backup.v1'
   assert manifest['session']['take']['base64']
   assert manifest['session']['groove']['schema_version']=='offbeat.groove.v1'
   page.once('dialog',lambda dialog:dialog.accept())
   page.get_by_role('button',name='Delete',exact=True).click()
   expect(page.get_by_text('Pocket groove',exact=True)).to_have_count(0)
   backup_file=page.get_by_label('OFFBEAT project backup file')
   backup_file.set_input_files({'name':'pocket.offbeat.json','mimeType':'application/json','buffer':backup})
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible(timeout=15000)
   expect(page.locator('p.status')).to_contain_text('integrity verified',timeout=15000)
   page.reload(wait_until='networkidle')
   ensure_open(page,'details.saved-drawer')
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible()
   page.get_by_role('button',name='Open',exact=True).click()
   expect(page.locator('.clip-done')).to_have_count(2)
   bad=json.loads(backup)
   original=bad['session']['take']['base64']
   bad['session']['take']['base64']=('A' if original[0]!='A' else 'B')+original[1:]
   backup_file.set_input_files({'name':'tampered.offbeat.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
   expect(page.locator('p.status')).to_contain_text('integrity verification',timeout=15000)
   page.once('dialog',lambda dialog:dialog.accept())
   page.get_by_role('button',name='Delete',exact=True).click()
   long_audio=synthetic_bass(23) # 69 seconds
   upload_take.set_input_files({"name":"long-take.wav","mimeType":"audio/wav","buffer":long_audio})
   expect(take.locator('.clip-done')).to_be_visible(timeout=120000)
   take.locator('details.clip-details').first.locator('summary').click()
   slider=take.get_by_role('slider',name='Your take analysis excerpt position')
   expect(slider).to_be_visible()
   slider.fill('8')
   expect(take.get_by_role('button',name='Analyze shape')).to_be_visible()
   take.get_by_role('button',name='Analyze shape').click()
   expect(take.locator('.clip-done')).to_be_visible(timeout=120000)
   page.get_by_placeholder('Name this idea…').fill('Long original kept')
   page.get_by_role('button',name='Keep this phrase').click()
   ensure_open(page,'details.saved-drawer')
   expect(page.get_by_text('Long original kept',exact=True)).to_be_visible()
   take.locator('details.clip-details').last.locator('summary').click()
   with page.expect_download() as original_download:
    take.get_by_role('link',name='Download original').click()
   assert Path(original_download.value.path()).read_bytes()==long_audio
   with page.expect_download() as saved:
    page.get_by_role('button',name='Export project').click()
   data=json.loads(Path(saved.value.path()).read_bytes())
   assert abs(data['session']['take']['excerpt_start_s']-8)<.01
   assert abs(data['session']['take']['full_duration_s']-69)<.2
   assert data['session']['take']['size']==len(long_audio)
   page.reload(wait_until='networkidle')
   ensure_open(page,'details.saved-drawer')
   page.get_by_role('button',name='Open',exact=True).click()
   take.locator('details.clip-details').first.locator('summary').click()
   assert abs(float(take.get_by_role('slider',name='Your take analysis excerpt position').input_value())-8)<.01
   assert all(':8765' not in url for url in requests),'Browser analysis unexpectedly requested Python server'
   assert all(url.startswith(('http://127.0.0.1:5173/','blob:http://127.0.0.1:5173/')) for url in requests),'Unexpected outbound request'
   print('PASS: mobile 320-430px, two take auto analysis, A/B, optional drums, WAV, save/import, long excerpt')
  finally:
   browser.close()

if __name__=='__main__':run()
