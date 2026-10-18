const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../public/instrument');
const files=['studio-bass-samples-v5.js','studio-bass-v5.js','studio-glide-v6.js'];
const sandbox={window:{},Uint8Array,Float32Array,Math,Number,WeakMap};
vm.runInNewContext(files.map(p=>fs.readFileSync(path.join(dir,p),'utf8')).join('\n'),sandbox);
const glide=sandbox.window.OffbeatStudioGlide;
const studio=sandbox.window.OffbeatStudioBass;
class Param{
 constructor(){this.events=[];this.value=0}
 setValueAtTime(v,t){this.events.push(['set',v,t])}
 setTargetAtTime(v,t,r){this.events.push(['target',v,t,r])}
 linearRampToValueAtTime(v,t){this.events.push(['linear',v,t])}
 cancelScheduledValues(t){this.events.push(['cancel',t])}
}
class Node{
 constructor(){this.gain=new Param();this.frequency=new Param();this.playbackRate=new Param();this.Q={value:0};this.started=[];this.stopped=[]}
 connect(n){return n}
 start(t,offset){this.started.push([t,offset])}
 stop(t){this.stopped.push(t)}
}
function env(){
 const nodes=[];
 const c={currentTime:0,
  createBufferSource(){const n=new Node();nodes.push(n);return n},
  createBiquadFilter(){return new Node()},createGain(){return new Node()}
 };
 const samples={};
 for(const name of ['E2','G2','As2','Cs3','E3']){
  samples[name]={buffer:{duration:9},start:.02,norm:.74,rms:.1};
 }
 // Unit injects decoded bank through exact exposed contract; browser tests verify decode.
 studio.decoded=()=>samples;
 return {c,nodes};
}
test('sampled GLIDE maps finger position smoothly to a bass range',()=>{
 assert.ok(glide.frequency(1)>glide.frequency(0)*2);
 for(let i=0;i<100;i++)assert.ok(glide.frequency(i/100)<glide.frequency((i+1)/100));
});
test('held bass voice uses recorded buffer sources and no oscillators',()=>{
 const a=env(),v=glide.create(a.c,new Node(),.015,.38,.47,'warm');
 assert.equal(v.kind,'sample-glide');
 assert.equal(v.parts.length,1);
 assert.equal(a.nodes.length,1);
 assert.ok(v.current.root);
 assert.equal(a.nodes[0].started[0][0],.015);
});
test('continuous bends smoothly change playback rate without retrigger at small distances',()=>{
 const a=env(),v=glide.create(a.c,new Node(),.015,.35,.47,'warm');
 glide.move(v,.18,.38,.53);
 assert.equal(v.parts.length,1);
 assert.ok(v.current.source.playbackRate.events.some(e=>e[0]==='target'));
 assert.ok(v.current.filter.frequency.events.some(e=>e[0]==='target'));
});
test('large pitch travel crossfades to a closer recording and skips duplicate attack',()=>{
 const a=env(),v=glide.create(a.c,new Node(),.015,.08,.47,'warm');
 glide.move(v,.31,.66,.43);
 assert.equal(v.parts.length,2);
 assert.notEqual(v.parts[0].root,v.parts[1].root);
 assert.ok(v.parts[0].stopped);
 assert.ok(v.parts[1].source.started[0][1]>.05);
 assert.ok(v.parts[0].gain.gain.events.some(e=>e[0]==='target'));
});
test('releases and emergency stop fade the sample and leave no active voices',()=>{
 const a=env(),v=glide.create(a.c,new Node(),.01,.2,.3,'edge');
 glide.move(v,.24,.9,.72);
 glide.stop(v,.4);
 assert.equal(v.stopped,true);
 assert.ok(v.parts.every(p=>p.stopped));
 const w=glide.create(a.c,new Node(),1,.48,.3,'warm');
 glide.kill(w,1.5);
 assert.equal(w.stopped,true);
 assert.ok(w.parts[0].source.stopped.some(t=>t<2));
});
test('v6 is used live and on WAV replay while legacy takes retain old voice',()=>{
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert.match(html,/studio-glide-v6\.js/);
 assert.match(html,/instrument==='studio-v6'&&gesture==='glide'/);
 assert.match(html,/studioGlide\.create/);
 assert.match(html,/studioGlide\.move/);
 assert.match(html,/studioGlide\.stop/);
 assert.match(html,/studioGlide\.kill/);
 assert.match(html,/instrument:'studio-v6'/);
 assert.match(html,/\[1,2,3,4,5,6\]\.includes\(saved\.version\)/);
 assert.match(html,/await studioBass\.preload\(c\)/);
});
