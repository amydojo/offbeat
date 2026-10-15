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

test('humming in the mid register retains stable pitch with rests',()=>{
 const sampling=ANALYSIS_SAMPLE_RATE;
 const tmax=4;
 const x=Float32Array.from({length:sampling*tmax},(_,i)=>{
  const t=i/sampling;
  const active=(t>=.25&&t<1.1)||(t>=1.5&&t<2.45)||(t>=2.85&&t<3.65);
  const vibrato=Math.sin(2*Math.PI*4*t)*1.5;
  return active ? .15*Math.sin(2*Math.PI*164.8*t + vibrato*.07) + .035*Math.sin(2*Math.PI*329.6*t) : 0;
 });
 const a=analyzePCM({...options,samples:x,sourceKind:'humming',durationSeconds:tmax});
 const clean=a.pitch_frames.filter(p=>p.voiced&&p.t_s>.48&&p.t_s<.9);
 assert.ok(clean.length>=5,'Insufficient humming frames');
 const medianHz=clean.map(p=>p.hz).sort((a,b)=>a-b)[Math.floor(clean.length/2)];
 assert.ok(medianHz>151&&medianHz<182,'Humming pitch was '+medianHz);
 assert.ok(a.rests.some(r=>r.start_s>=1.05&&r.end_s<=1.6));
});
test('harmonic-rich bass still prefers fundamental, not an octave',()=>{
 const rate=ANALYSIS_SAMPLE_RATE,hz=41.203;
 const samples=Float32Array.from({length:rate*3},(_,i)=>{
  const t=i/rate,active=t>.25&&t<2.75;
  return active?.14*Math.sin(2*Math.PI*hz*t)+.21*Math.sin(4*Math.PI*hz*t)+.08*Math.sin(6*Math.PI*hz*t):0;
 });
 const a=analyzePCM({...options,samples,durationSeconds:3});
 const good=a.pitch_frames.filter(p=>p.voiced&&p.t_s>.7&&p.t_s<2.2).map(p=>p.hz);
 assert.ok(good.length>=15,'Harmonic-rich bass was unvoiced');
 const goodE=good.filter(x=>x>37&&x<47);
 assert.ok(goodE.length/good.length>=.6,'Bass octave was misdetected '+JSON.stringify(good.slice(0,12)));
});
test('energy attacks are close to simple clean articulation and do not multiply without cause',()=>{
 const rate=ANALYSIS_SAMPLE_RATE;
 const expected=[.31,1.12,1.94,2.73];
 const samples=Float32Array.from({length:rate*3.3},(_,i)=>{
  const t=i/rate;
  const at=expected.find(x=>t>=x&&t<x+.32);
  if(at===undefined)return 0;
  const ramp=Math.min(1,(t-at)/.024);
  return ramp*.27*Math.sin(2*Math.PI*110*t);
 });
 const a=analyzePCM({...options,samples,durationSeconds:3.3});
 for(const t of expected){
  assert.ok(a.onsets.some(o=>Math.abs(o.t_s-t)<.085),
   'Missed attack '+t+'; observed '+JSON.stringify(a.onsets));
 }
 assert.ok(a.onsets.length<=expected.length+2,'Unexpected repeated attacks: '+JSON.stringify(a.onsets));
});
test('near-silence and very short files remain honest',()=>{
 const rate=ANALYSIS_SAMPLE_RATE;
 const quiet=Float32Array.from({length:rate},(_,i)=>.001*Math.sin(2*Math.PI*150*i/rate));
 const a=analyzePCM({...options,samples:quiet,durationSeconds:1});
 assert.ok(a.quality_flags.includes('near_silent'));
 assert.ok(a.pitch_frames.every(p=>!p.voiced));
 assert.throws(()=>analyzePCM({...options,samples:new Float32Array(0),durationSeconds:0}),/shorter than 60 seconds/);
});
