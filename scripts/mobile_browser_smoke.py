"""Phone-sized browser journey with local DSP only. No Python requests or cloud audio."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
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
   groove=page.get_by_role('region',name='Responsive drummer')
   expect(groove.get_by_role('button',name='Follow')).to_be_visible()
   for width in [320,360,390,430]:
    page.set_viewport_size({"width":width,"height":844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),'Groove overflow at '+str(width)
   page.set_viewport_size({"width":390,"height":844})
   groove.get_by_role('button',name='Answer').click()
   expect(groove.get_by_role('button',name='Answer')).to_have_attribute('aria-pressed','true')
   groove.get_by_role('button',name='Contrast').click()
   expect(groove.get_by_role('button',name='Contrast')).to_have_attribute('aria-pressed','true')
   groove.get_by_role('button',name='Follow').click()
   expect(groove.get_by_role('button',name='Follow')).to_have_attribute('aria-pressed','true')
   groove.get_by_role('slider',name='Drum density').fill('0.85')
   groove.get_by_role('button',name='New variation').click()
   groove.get_by_role('button',name='Play with drums').click()
   expect(groove.get_by_role('button',name='Stop groove')).to_be_visible(timeout=12000)
   expect(groove.get_by_role('status')).to_contain_text('2 loops started.',timeout=16000)
   groove.get_by_role('button',name='Stop groove').click()
   expect(groove.get_by_role('button',name='Play with drums')).to_be_enabled()
   with page.expect_download(timeout=30000) as mixed_download:
    groove.get_by_role('button',name='Export mixed WAV').click()
   wav=mixed_download.value
   assert wav.suggested_filename.endswith('.wav')
   wav_bytes=Path(wav.path()).read_bytes()
   assert wav_bytes[:4]==b'RIFF' and wav_bytes[8:12]==b'WAVE'
   assert len(wav_bytes)>12000,'An actual mixed WAV should contain nontrivial PCM samples'
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
   # Export must contain the exact original audio and analysis, without uploading.
   with page.expect_download() as download_info:
    page.get_by_role('button',name='Export project').click()
   download=download_info.value
   assert download.suggested_filename.endswith('.offbeat.json')
   backup_bytes=Path(download.path()).read_bytes()
   manifest=json.loads(backup_bytes)
   assert manifest['schema_version']=='offbeat.backup.v1'
   assert manifest['session']['take']['base64']
   assert manifest['session']['groove']['schema_version']=='offbeat.groove.v1'
   assert manifest['session']['groove']['mode']=='follow'
   assert manifest['session']['groove']['events']
   # A delete followed by a verified local import must restore the project.
   page.once('dialog',lambda dialog:dialog.accept())
   page.get_by_role('button',name='Delete',exact=True).click()
   expect(page.get_by_text('Pocket groove',exact=True)).to_have_count(0)
   backup_file=page.get_by_label('OFFBEAT project backup file')
   backup_file.set_input_files({'name':'pocket-groove.offbeat.json','mimeType':'application/json','buffer':backup_bytes})
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible(timeout=15000)
   expect(page.locator('p.status')).to_contain_text('integrity verified',timeout=10000)
   page.reload(wait_until='networkidle')
   expect(page.get_by_text('Pocket groove',exact=True)).to_be_visible()
   page.get_by_role('button',name='Open',exact=True).click()
   expect(page.get_by_role('button',name='Analyze again')).to_have_count(2)
   expect(page.get_by_role('region',name='Responsive drummer').get_by_role('button',name='Follow')).to_have_attribute('aria-pressed','true')
   # Corrupting a still-valid base64 payload must fail SHA-256 integrity.
   bad=json.loads(backup_bytes)
   bad_audio=bad['session']['take']['base64']
   bad['session']['take']['base64']=('A' if bad_audio[0]!='A' else 'B')+bad_audio[1:]
   backup_file.set_input_files({'name':'tampered.offbeat.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
   expect(page.locator('p.status')).to_contain_text('integrity verification',timeout=10000)
   assert page.get_by_text('Pocket groove',exact=True).count()==1
   page.once('dialog',lambda dialog:dialog.accept())
   page.get_by_role('button',name='Delete',exact=True).click()
   expect(page.get_by_text('Pocket groove',exact=True)).to_have_count(0)
   assert all(':8765' not in url for url in calls),'Browser analysis must never depend on Python API'
   assert all(url.startswith(('http://127.0.0.1:5173/','blob:http://127.0.0.1:5173/')) for url in calls),'Unexpected external request: '+str(calls)
   print('PASS: mobile viewport, browser DSP, comparison, A/B, IndexedDB, zero audio network')
  finally:browser.close()
if __name__=='__main__':run()
