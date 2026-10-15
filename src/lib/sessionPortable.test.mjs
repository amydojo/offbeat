import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionBackup,parseSessionBackup} from './sessionPortable.mjs';
import {generateGroove} from './grooveEngine.mjs';
const audio=new Uint8Array([82,73,70,70,42,0,0,0,87,65,86,69,1,2,3,4]);
async function fixture(){
 const file=new File([audio],'hum.wav',{type:'audio/wav'});
 const checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',audio)),v=>v.toString(16).padStart(2,'0')).join('');
 const a={schema_version:'offbeat.phrase.v1',analysis_id:crypto.randomUUID(),
  source:{sha256:checksum,kind:'humming',duration_s:1},
  pitch_frames:[],onsets:[],rests:[]};
 return {schema_version:'offbeat.session.v1',id:crypto.randomUUID(),title:'Dun dun riff',
  createdAt:new Date().toISOString(),selection:{start:0,end:1},
  reference:null,take:{name:file.name,mime:file.type,blob:file,analysis:a},comparison:null};
}
test('portable backup round trips original bytes and analysis without server',async()=>{
 const original=await fixture();
 const text=await createSessionBackup(original);
 assert.equal(JSON.parse(text).schema_version,'offbeat.backup.v1');
 const imported=await parseSessionBackup(new File([text],'phrase.offbeat.json'));
 assert.equal(imported.title,'Dun dun riff');
 assert.equal(imported.take.analysis.analysis_id,original.take.analysis.analysis_id);
 assert.deepEqual(new Uint8Array(await imported.take.file.arrayBuffer()),audio);
 assert.equal(imported.selection.end,1);
});
test('tampered audio is refused even if JSON still parses',async()=>{
 const original=await fixture();
 const data=JSON.parse(await createSessionBackup(original));
 data.session.take.base64=btoa('a'.repeat(audio.length));
 await assert.rejects(()=>parseSessionBackup(new File([JSON.stringify(data)],'corrupt.json')),/integrity verification/);
});
test('incorrect or unsupported project versions fail safely',async()=>{
 await assert.rejects(()=>parseSessionBackup(new File(['{"schema_version":"fake"}'],'fake.json')),/Unsupported OFFBEAT backup/);
 await assert.rejects(()=>parseSessionBackup(new File(['NOPE'],'not-json.txt')),/not a readable/);
});
test('mobile export rejects oversized source audio before encoding',async()=>{
 const original=await fixture();
 original.take.blob=new Blob([new Uint8Array(12*1024*1024+1)],{type:'audio/wav'});
 await assert.rejects(()=>createSessionBackup(original),/12 MB/);
});

test('portable projects include deterministic and source-validated Groove event recipes',async()=>{
 const original=await fixture();
 original.take.analysis.source.duration_s=1;
 original.take.analysis.onsets=[{t_s:.2,strength:.8},{t_s:.55,strength:.6}];
 original.take.analysis.rests=[{start_s:.7,end_s:.95}];
 original.groove=generateGroove(original.take.analysis,{mode:'follow',start:0,end:1,seed:27});
 const json=await createSessionBackup(original);
 const imported=await parseSessionBackup(new File([json],'groove.offbeat.json'));
 assert.deepEqual(imported.groove,original.groove);
 const invalid=JSON.parse(json);
 invalid.session.groove.events[0].time_s=999;
 const bad=await parseSessionBackup(new File([JSON.stringify(invalid)],'bad-groove.offbeat.json'));
 assert.equal(bad.groove,null,'unsafe groove recipe must never be trusted');
});
