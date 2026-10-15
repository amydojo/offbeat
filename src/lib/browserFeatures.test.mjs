import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePCM,ANALYSIS_SAMPLE_RATE} from './browserFeatures.mjs';
import {compareLocal} from './browserCompare.mjs';
const hz=41.203;
function phrase(frequency=hz,seconds=3){
 const N=Math.floor(ANALYSIS_SAMPLE_RATE*seconds);
 return Float32Array.from({length:N},(_,i)=>{
  const t=i/ANALYSIS_SAMPLE_RATE;
  const active=(t>.1&&t<.85)||(t>1.1&&t<2.4);
  return active?.35*Math.sin(2*Math.PI*frequency*t):0;
 });
}
const options={originalSampleRate:ANALYSIS_SAMPLE_RATE,originalChannels:1,originalMime:'audio/wav',sourceSha256:'a'.repeat(64),sourceKind:'solo_bass'};
test('on-device musical contour represents low E1 and deliberate silences',()=>{
 const result=analyzePCM({...options,samples:phrase(),durationSeconds:3});
 assert.equal(result.schema_version,'offbeat.phrase.v1');
 assert.ok(result.onsets.length>=1);
 assert.ok(result.rests.some(r=>r.end_s-r.start_s>=.12));
 const good=result.pitch_frames.filter(f=>f.voiced).map(f=>f.hz).sort((a,b)=>a-b);
 assert.ok(good.length>=10,JSON.stringify(result.quality_flags));
 const med=good[Math.floor(good.length/2)];
 assert.ok(med>=37&&med<=47,'Median inferred low E pitch was '+med);
 assert.ok(result.pitch_frames.some(f=>!f.voiced&&f.hz===null));
 assert.ok(result.quality_flags.includes('pitch_confidence_uncalibrated'));
});
test('silence never becomes an invented note',()=>{
 const result=analyzePCM({...options,samples:new Float32Array(ANALYSIS_SAMPLE_RATE),durationSeconds:1});
 assert.ok(result.pitch_frames.every(f=>f.hz===null&&!f.voiced));
});
test('comparisons align matching excerpt ranges without altering originals',()=>{
 const a=analyzePCM({...options,samples:phrase(82.4,3),durationSeconds:3});
 const b=analyzePCM({...options,samples:phrase(123.5,3),durationSeconds:3});
 const frozen=JSON.stringify(a);
 const out=compareLocal(a,b,{referenceRegion:{start_s:0,end_s:3}});
 assert.equal(out.schema_version,'offbeat.compare.v1');
 assert.equal(out.alignment.reference_duration_s,3);
 assert.equal(out.alignment.reference_region_end_s,3);
 assert.equal(JSON.stringify(a),frozen);
 assert.ok(out.warnings.some(x=>x.includes('not proof')));
});
test('long reference without a matching excerpt must be rejected',()=>{
 const a=analyzePCM({...options,samples:phrase(82.4,12),durationSeconds:12});
 const b=analyzePCM({...options,samples:phrase(82.4,3),durationSeconds:3});
 assert.throws(()=>compareLocal(a,b),/differ too much/);
 assert.ok(compareLocal(a,b,{referenceRegion:{start_s:2,end_s:5}}).schema_version);
});
