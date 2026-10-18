const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../public/instrument/pluck-v4.js'),'utf8');
const bank=fs.readFileSync(path.join(__dirname,'../public/instrument/bass-samples-v4.js'),'utf8');
const sandbox={window:{},WeakMap,Uint8Array,Float32Array,Math,Number};
vm.runInNewContext(bank+'\n'+code,sandbox);
const pluck=sandbox.window.OffbeatPluck;
class Param{constructor(){this.events=[]}setValueAtTime(v,t){this.events.push(['set',v,t])}linearRampToValueAtTime(v,t){this.events.push(['linear',v,t])}exponentialRampToValueAtTime(v,t){this.events.push(['exp',v,t])}cancelScheduledValues(){}}
class Node{constructor(){this.frequency=new Param();this.gain=new Param();this.playbackRate=new Param();this.Q={value:0};this.started=[];this.stopped=[]}connect(t){return t}start(t){this.started.push(t)}stop(t){this.stopped.push(t)}}
function context(){
 let bufferCreated=0,oscCreated=0,nodes=[];
 const c={currentTime:0,sampleRate:44100,
  createBuffer(ch,length,sr){bufferCreated++;const data=new Float32Array(length);return {sampleRate:sr,length,duration:length/sr,getChannelData(){return data}}},
  createBufferSource(){const n=new Node();nodes.push(n);return n},
  createGain(){return new Node()},createBiquadFilter(){return new Node()},
  createOscillator(){oscCreated++;return new Node()}
 };
 return {c,nodes,counts:()=>({bufferCreated,oscCreated})};
}
test('octave-ranged instrument has eight ascending pitches and no arbitrary slides',()=>{
 assert.equal(pluck.notes.length,8);
 assert.equal(pluck.index(0),0);
 assert.equal(pluck.index(1),7);
 assert.equal(pluck.index(.45),3);
 for(let i=1;i<8;i++)assert.ok(pluck.notes[i]>pluck.notes[i-1]);
});
test('pluck synthesizer excites a one-shot string rather than a continuous oscillator',()=>{
 const a=context(),dest=new Node();
 const v=pluck.play(a.c,dest,.015,3/7,.56,'warm');
 assert.ok(v.sources.length>=1);
 assert.equal(a.counts().oscCreated,0);
 assert.equal(v.sources[0].started[0],.015);
 assert.ok(v.sources[0].stopped[0]>.8);
 const signal=v.sources[0].buffer.getChannelData(0);
 let peak=0,power=0;for(const x of signal){peak=Math.max(peak,Math.abs(x));power+=x*x}
 assert.ok(peak>.03);assert.ok(power/signal.length>.000001);
 pluck.kill(v,.1);
 assert.equal(v.stopped,true);
});
test('struck string sample buffers are deterministic and cached for low-latency retrigger',()=>{
 const a=context(),dest=new Node();
 const first=pluck.play(a.c,dest,.1,.2,.4,'warm');
 const second=pluck.play(a.c,dest,.4,.2,.7,'warm');
 assert.equal(first.sources[0].buffer,second.sources[0].buffer);
 assert.equal(a.counts().bufferCreated,1);
 const edge=pluck.play(a.c,dest,.5,.2,.7,'edge');
 assert.notEqual(edge.sources[0].buffer,first.sources[0].buffer);
});
test('internal archived bass samples are bundled locally as immutable MP3 fragments',()=>{
 const data=sandbox.window.OffbeatBassSamples;
 for(const key of ['low','pulse','rise','other']){
  assert.equal(typeof data[key],'string');
  assert.ok(data[key].length>3000);
  assert.ok(data[key].startsWith('SUQz'));
 }
});
test('FORM UI contains discrete strings and retains historical replay support',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/instrument/index.html'),'utf8');
 assert.match(html,/bassGesture='pluck'/);
 assert.match(html,/TAP A STRING/);
 assert.match(html,/id="kick"/);assert.match(html,/id="snare"/);assert.match(html,/id="hat"/);
 assert.match(html,/e\.type==='pluck'/);
 assert.match(html,/version:6/);
 assert.match(html,/\[1,2,3,4,5,6\]\.includes\(saved\.version\)/);
 assert.match(html,/pluckEngine\.play/);
});
