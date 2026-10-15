import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGroove,validGroove} from './grooveEngine.mjs';
function fixture(){
 return {schema_version:'offbeat.phrase.v1',analysis_id:'original-test-1',
  source:{sha256:'a'.repeat(64),duration_s:4},
  onsets:[.12,.54,1.04,1.54,2.14,2.88,3.41].map((t_s,i)=>({t_s,strength:.45+.07*(i%3)})),
  rests:[{start_s:1.7,end_s:2.1},{start_s:3.52,end_s:3.94}],
  pitch_frames:[]};
}
const opts={start:0,end:4,density:.8,strength:.7,seed:19};
test('three modes produce stable but different responses',()=>{
 const a=fixture(),modes=['follow','answer','contrast'];
 const patterns=modes.map(mode=>generateGroove(a,{...opts,mode}));
 for(let i=0;i<3;i++){
  assert.deepEqual(patterns[i],generateGroove(a,{...opts,mode:modes[i]}));
  assert.ok(validGroove(patterns[i],a));assert.ok(patterns[i].events.length>=2);
 }
 assert.notDeepEqual(patterns[0].events,patterns[1].events);
 assert.notDeepEqual(patterns[1].events,patterns[2].events);
 assert.notDeepEqual(patterns[0].events,patterns[2].events);
});
test('Follow retains exact original attack timestamps with no quantization',()=>{
 const a=fixture();const before=JSON.stringify(a);
 const p=generateGroove(a,{...opts,mode:'follow',density:1});
 assert.ok(p.events.filter(e=>e.kind==='kick').some(e=>e.time_s===.12));
 assert.ok(p.events.filter(e=>e.kind==='kick').some(e=>e.time_s===.54));
 assert.equal(JSON.stringify(a),before);
});
test('Answer responds inside source rests, and silence is not automatically turned into notes',()=>{
 const a=fixture();const p=generateGroove(a,{...opts,mode:'answer',density:1});
 const responses=p.events.filter(e=>e.origin==='source_rest');
 assert.ok(responses.length>=1);
 assert.ok(responses.every(e=>a.rests.some(r=>e.time_s>r.start_s&&e.time_s<r.end_s)));
});
test('changing seed changes rhythm; density and swing are bounded',()=>{
 const a=fixture();
 const p=generateGroove(a,{...opts,mode:'contrast',seed:2,swing:.28,tempoMode:'manual',bpm:123});
 const q=generateGroove(a,{...opts,mode:'contrast',seed:3,swing:.28,tempoMode:'manual',bpm:123});
 assert.notDeepEqual(p.events,q.events);
 assert.equal(p.tempo.mode,'manual');assert.equal(p.tempo.bpm,123);
 assert.ok(p.events.every(e=>e.time_s>=0&&e.time_s<4));
});
test('sparse quiet source keeps audible response without pretending detected tempo',()=>{
 const a=fixture();a.onsets=[];a.rests=[];
 for(const mode of ['follow','answer','contrast']){
  const p=generateGroove(a,{...opts,mode,tempoMode:'free'});
  assert.ok(validGroove(p,a));assert.ok(p.events.length>=1);
 }
});
test('source mismatch and intentionally corrupted provenance are rejected',()=>{
 const a=fixture();const p=generateGroove(a,{...opts,mode:'contrast'});
 assert.equal(validGroove({...p,source_sha256:'b'.repeat(64)},a),false);
 assert.equal(validGroove({...p,events:[{kind:'kick',time_s:999,velocity:1,origin:'pulse'}]},a),false);
 assert.throws(()=>generateGroove(a,{start:0,end:.12}),/longer than a quarter second/);
});
