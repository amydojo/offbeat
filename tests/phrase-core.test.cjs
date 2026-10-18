const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../public/performance-memory/phrase-core.js');

function makeRecording(duration,patterns){
 const sr=12000,arr=new Float32Array(Math.round(duration*sr));
 for(const {at,offsets} of patterns){
  for(const offset of offsets){
   const start=Math.round((at+offset)*sr);
   for(let i=0;i<2100&&start+i<arr.length;i++)
    arr[start+i]+=.34*Math.sin(2*Math.PI*76*i/sr)*Math.exp(-i/420);
  }
 }
 return {duration,sampleRate:sr,getChannelData:()=>arr};
}
test('catches a motif reappearing minutes apart',()=>{
 const audio=makeRecording(180,[
  {at:12,offsets:[0,.4,.86,1.57,1.99,2.8,3.45]},
  {at:48,offsets:[0,.4,.86,1.57,1.99,2.8,3.45]},
  {at:107,offsets:[0,.4,.86,1.57,1.99,2.8,3.45]}
 ]);
 const result=core.analyze(audio,{minSimilarity:.48});
 assert.ok(result.onsets>=15);
 assert.ok(result.matches.length>=1);
 assert.ok(result.matches.some(m=>m.b-m.a>25));
 assert.equal(result.overview.length,144);
});
test('does not match only due to near-overlapping windows',()=>{
 const audio=makeRecording(33,[{at:7,offsets:[0,.4,.86,1.57,1.99,2.8,3.45]}]);
 const result=core.analyze(audio,{minSimilarity:.4,minSeparation:25});
 assert.equal(result.matches.length,0);
});
test('scores relative onset shape over absolute volume',()=>{
 const a={rhythm:[1,0,.4,0,1,.2,0],texture:[1,.6,1.2,.9,1,.5,.8],count:7};
 const b={rhythm:[1,0,.4,0,1,.2,0],texture:[1,.6,1.2,.9,1,.5,.8],count:7};
 const c={rhythm:[0,0,0,1,0,0,1],texture:[1,.2,.1,.1,.2,2.1,.1],count:2};
 assert.ok(core.compare(a,b)>.95);
 assert.ok(core.compare(a,c)<.5);
});
test('empty and silent recordings return safe, honest results',()=>{
 const audio=makeRecording(18,[]);
 const out=core.analyze(audio);
 assert.equal(out.matches.length,0);
 assert.equal(out.overview.length,144);
 assert.equal(out.onsets,0);
});
test('fingerprints do not mutate original onset evidence',()=>{
 const audio=makeRecording(18,[{at:1,offsets:[0,.5,1,1.5,2,2.5,3,3.5]}]);
 const frames=core.featureFrames(audio),onsets=core.detectOnsets(frames);
 const old=JSON.stringify(onsets);
 core.makeWindows(frames,onsets);
 assert.equal(JSON.stringify(onsets),old);
});
