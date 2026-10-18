const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../public/instrument/bass-v3.js'),'utf8');
const context={window:{}};vm.runInNewContext(code,context,{filename:'bass-v3.js'});
const b=context.window.OffbeatBass;
class Parameter {
 constructor(){this.events=[]}
 setValueAtTime(x,t){this.events.push(['set',x,t])}
 linearRampToValueAtTime(x,t){this.events.push(['linear',x,t])}
 exponentialRampToValueAtTime(x,t){this.events.push(['exp',x,t])}
 setTargetAtTime(x,t,c){this.events.push(['target',x,t,c])}
 cancelScheduledValues(t){this.events.push(['cancel',t])}
}
class Node {
 constructor(type){this.kind=type;this.gain=new Parameter();this.frequency=new Parameter();this.Q={value:0};this.connections=[];this.started=[];this.stopped=[];this.type=''}
 connect(dest){this.connections.push(dest);return dest}
 start(t){this.started.push(t)}
 stop(t){this.stopped.push(t)}
}
function fakeAudio(shaper=true){
 const nodes=[];
 const ctx={
  createOscillator(){const n=new Node('osc');nodes.push(n);return n},
  createGain(){const n=new Node('gain');nodes.push(n);return n},
  createBiquadFilter(){const n=new Node('filter');nodes.push(n);return n},
  createWaveShaper:shaper?()=>{const n=new Node('shaper');nodes.push(n);return n}:undefined
 };
 return {ctx,nodes,destination:new Node('destination')};
}
test('RIFF maps to a limited, ascending bass-friendly set of pitches',()=>{
 assert.equal(b.notes.length,8);
 assert.equal(b.riffFrequency(0),b.notes[0]);
 assert.equal(b.riffFrequency(1),b.notes[7]);
 for(let i=1;i<8;i++)assert.ok(b.notes[i]>b.notes[i-1]);
 for(let i=0;i<=100;i++)assert.ok(b.notes.includes(b.riffFrequency(i/100)));
 assert.notEqual(b.glideFrequency(.42),b.riffFrequency(.42));
});
test('WARM starts with sine fundamental plus soft, decaying harmonics',()=>{
 const a=fakeAudio(),v=b.create(a.ctx,a.destination,1,.32,.4,'hold','warm','riff');
 assert.equal(v.o.type,'sine');
 assert.equal(v.u.type,'triangle');
 assert.equal(v.o.started[0],1);
 assert.equal(v.u.started[0],1);
 const harmonics=v.h.gain.events.filter(e=>e[0]==='exp');
 assert.ok(harmonics.length>=2);
 assert.ok(harmonics[0][1]>harmonics[1][1]);
 assert.equal(v.gesture,'riff');
});
test('EDGE is brighter but still rooted in a bass fundamental',()=>{
 const a=fakeAudio(),v=b.create(a.ctx,a.destination,0,.32,.85,'hold','edge','riff');
 assert.equal(v.o.type,'sine');
 assert.equal(v.u.type,'sawtooth');
 assert.ok(v.f.frequency.events[0][1]<2500);
});
test('Moving across RIFF lanes creates intentional new note attacks, not nervous jitter',()=>{
 const a=fakeAudio(),v=b.create(a.ctx,a.destination,0,.1,.4,'hold','warm','riff');
 const initial=v.index;
 const attacks=()=>v.g.gain.events.filter(e=>e[0]==='cancel').length;
 const first=attacks();
 b.move(v,.02,.12,.4); // minor hand noise
 assert.equal(v.index,initial);
 assert.equal(attacks(),first);
 b.move(v,.13,.52,.6); // deliberate contour movement
 assert.ok(v.index>initial);
 assert.ok(attacks()>first);
});
test('GLIDE remains continuous and does not retrigger notes on pitch movement',()=>{
 const a=fakeAudio(),v=b.create(a.ctx,a.destination,.4,.1,.4,'hold','warm','glide');
 const before=v.g.gain.events.length;
 b.move(v,.5,.45,.4);b.move(v,.7,.9,.7);
 assert.equal(v.g.gain.events.length,before);
 assert.ok(v.o.frequency.events.some(e=>e[0]==='target'));
});
test('Release and emergency stop silence voices without cutting the drum mixer',()=>{
 const a=fakeAudio(false),v=b.create(a.ctx,a.destination,0,.3,.4,'hold','warm','riff');
 b.stop(v,.2);
 assert.equal(v.stopped,true);
 assert.equal(v.o.stopped.length,1);
 assert.equal(v.u.stopped.length,1);
 const w=b.create(a.ctx,a.destination,1,.7,.4,'hold','edge','glide');
 b.kill(w,1.15);
 assert.equal(w.stopped,true);
 assert.equal(w.o.stopped.length,1);
});
test('Future timestamps are honored for deterministic offline WAV synthesis',()=>{
 const a=fakeAudio(),v=b.create(a.ctx,a.destination,4,.3,.7,'hold','warm','riff');
 assert.equal(v.o.started[0],4);
 b.move(v,4.25,.9,.3);
 b.stop(v,4.7);
 assert.ok(v.o.stopped[0]>4.7);
});
test('FORM loads bass before inline instrument, saves v3 and preserves v1/v2 compatibility',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/instrument/index.html'),'utf8');
 const dependency=html.indexOf('/instrument/bass-v3.js');
 assert.ok(dependency>0&&dependency<html.indexOf('<script>',dependency));
 assert.match(html,/id="bassMode"/);
 assert.match(html,/gesture:bassGesture/);
 assert.match(html,/seq\.gesture\|\|'glide'/);
 assert.match(html,/\[1,2,3\]\.includes\(saved\.version\)/);
 assert.match(html,/bassEngine\.kill/);
 assert.ok(!html.includes('function freq(p){return 98*Math.pow'));
});
