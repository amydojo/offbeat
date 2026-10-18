const test=require('node:test');
const assert=require('node:assert/strict');
const pitch=require('../public/performance-memory/pitch-core.js');
const SR=12000, STARTS=[.32,.94,1.64,2.38];
function recording(freqs,duration=4.1){
 const data=new Float32Array(Math.round(duration*SR));
 for(let k=0;k<freqs.length;k++){
  const first=Math.round(STARTS[k]*SR),freq=freqs[k];
  for(let i=0;i<4300&&first+i<data.length;i++){
   data[first+i]+=.27*Math.sin(2*Math.PI*freq*i/SR)*Math.exp(-i/2500);
   data[first+i]+=.045*Math.sin(4*Math.PI*freq*i/SR)*Math.exp(-i/2400);
  }
 }
 return {sampleRate:SR,duration,getChannelData:()=>data};
}
test('recognizes an electric-bass-range E1 fundamental without octave doubling',()=>{
 const single=recording([41.203,55,65.406,82.4]);
 const p=pitch.estimate(single,STARTS[0]);
 assert.ok(p,'bass note was undetected');
 assert.ok(Math.abs(p.frequency-41.203)<1.5,'measured '+p.frequency);
 assert.ok(p.confidence>.65);
});
test('transposed phrase keeps the same relative melodic contour',()=>{
 const a=pitch.phrase(recording([55,65.406,73.416,82.407]),STARTS,0,{duration:4.1});
 const b=pitch.phrase(recording([65.406,77.78,87.31,98]),STARTS,0,{duration:4.1});
 assert.equal(a.length,4);assert.equal(b.length,4);
 const cmp=pitch.compareNotes(a,b);
 assert.equal(cmp.available,true);assert.ok(cmp.score>.80,'score '+cmp.score);
 assert.ok(Math.abs(cmp.shiftSemitones-3)<1);
});
test('reversing pitch direction changes musical similarity',()=>{
 const a=pitch.phrase(recording([55,65.406,73.416,82.407]),STARTS,0,{duration:4.1});
 const b=pitch.phrase(recording([82.407,73.416,65.406,55]),STARTS,0,{duration:4.1});
 assert.ok(pitch.compareNotes(a,b).score<.48);
});
test('silence never turns into confident notes',()=>{
 const audio={sampleRate:SR,duration:4.1,getChannelData:()=>new Float32Array(SR*5)};
 assert.equal(pitch.estimate(audio,.2),null);
 assert.equal(pitch.phrase(audio,STARTS,0,{duration:4.1}).length,0);
 assert.equal(pitch.compareNotes([],[]).available,false);
});
test('fewer than three usable notes cannot claim melodic identity',()=>{
 const n=[{midi:45,confidence:.9,octaveRisk:false},{midi:49,confidence:.9,octaveRisk:false}];
 assert.equal(pitch.compareNotes(n,n).available,false);
});
