// Regression tests for the mobile FORM rhythm partner (no browser or audio hardware needed).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const file=path.join(__dirname,'../public/instrument/rhythm-v2.js');
const content=fs.readFileSync(file,'utf8');
const context={window:{}};
vm.runInNewContext(content,context,{filename:file});
const rhythm=context.window.OffbeatRhythm;
const beatTaps=(bpm,n=10,sub=1)=>Array.from({length:n},(_,i)=>i*(60/bpm)*sub);
function followTempo(taps,from=100){
 let bpm=from;
 for(let i=4;i<=taps.length;i++)bpm=rhythm.estimateTempo(taps.slice(0,i),bpm).bpm;
 return bpm;
}
test('common quarter-note rates converge after several taps',()=>{
 for(const bpm of [75,80,90,100,110,128,145]){
   assert.ok(Math.abs(followTempo(beatTaps(bpm))-bpm)<=6,bpm+' BPM');
 }
});
test('eighth-note taps resolve plausible human pulse',()=>{
 for(const bpm of [80,90,100,110,128]){
   assert.ok(Math.abs(followTempo(beatTaps(bpm,10,.5))-bpm)<=8,bpm+' BPM eighths');
 }
});
test('insufficient or implausible data does not fabricate a confident tempo',()=>{
 assert.equal(rhythm.estimateTempo([0,.08,.16,.24],100).confidence,'waiting');
 assert.equal(rhythm.estimateTempo([0,.4,.8],100).confidence,'waiting');
});
test('pocket does not overwrite the original and nudges only manually played drums',()=>{
 const original=[
   {t:.034,type:'drum',kind:'kick',velocity:.7},
   {t:.270,type:'drum',kind:'snare',velocity:.8},
   {t:.523,type:'drum',kind:'hat',generated:true,velocity:.4},
   {t:.42,type:'down',p:.5,b:.2},
   {t:.68,type:'move',p:.6,b:.2}
 ];
 const before=JSON.stringify(original);
 const raw=rhythm.kitEvents(original,0,120,'raw');
 const adjusted=rhythm.kitEvents(original,0,120,'tight');
 assert.equal(JSON.stringify(original),before);
 assert.equal(raw[0].t,.034);
 assert.notEqual(adjusted[0].t,.034);
 assert.equal(adjusted[2].t,.523);
 assert.equal(adjusted[3].t,.42);
 assert.equal(adjusted[4].t,.68);
 assert.ok(Math.abs(adjusted[1].t-original[1].t)<=.07);
});
test('standalone FORM page loads rhythm dependency before instrument initialization',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/instrument/index.html'),'utf8');
 const a=html.indexOf('<script src="/instrument/rhythm-v2.js"></script>');
 const b=html.indexOf('<script>',a+1);
 assert.ok(a>0&&b>a);
 assert.match(html,/id="kick"/);assert.match(html,/id="snare"/);assert.match(html,/id="hat"/);
 assert.match(html,/id="drumMode"/);assert.match(html,/id="pocket"/);
});
