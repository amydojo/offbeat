/* OFFBEAT FORM 005 — Sampled electric-bass voice.
 * Notes recorded by Karoryfer; CC BY 3.0 via nbrosowsky/tonejs-instruments.
 * Five pitch-rooted samples, nearest-note resampling, short natural note gating.
 * No pitch-oscillator; no generative model; all bytes bundled on this origin.
 */
(function(root){
'use strict';
const roots={E2:82.4069,G2:97.9989,As2:116.5409,Cs3:138.5913,E3:164.8138};
const notes=[73.416,87.307,97.999,110,130.813,146.832,174.614,195.998];
const weak=new WeakMap(), clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
function pickNote(p){return notes[Math.round(clamp(p,0,1)*7)]}
function choose(freq,entries){
  let winner=null,diff=Infinity;
  for(const [name,source] of Object.entries(entries)){
    const semitones=Math.abs(12*Math.log2(freq/roots[name]));
    if(semitones<diff){winner={name,source,rate:freq/roots[name]},diff=semitones}
  }
  return winner;
}
function analyze(buffer){
  let ch=buffer.getChannelData(0),sr=buffer.sampleRate||44100;
  const max=Math.min(ch.length,Math.floor(sr*1.3)),step=Math.max(1,Math.floor(sr/5500));
  let peak=0;
  for(let i=0;i<max;i+=step)peak=Math.max(peak,Math.abs(ch[i]));
  const min=Math.max(.001,peak*.038);
  let start=0,window=Math.max(64,Math.floor(sr*.003)),found=false;
  // Locate a real transient, ignoring encoder noise / quiet leading silence.
  for(let i=0;i<max-window;i+=window){
    let sum=0;
    for(let j=i;j<i+window;j+=step)sum+=ch[j]*ch[j];
    if(Math.sqrt(sum/(Math.ceil(window/step)||1))>min){start=Math.max(0,i-Math.floor(sr*.006));found=true;break}
  }
  if(!found)start=0;
  let sq=0,n=0;
  const end=Math.min(ch.length,start+Math.floor(sr*.25));
  for(let i=start;i<end;i+=step){sq+=ch[i]*ch[i];n++}
  const rms=Math.sqrt(sq/Math.max(1,n));
  return {buffer,start:start/sr,peak,rms,norm:clamp(.115/Math.max(.01,rms),.5,3.0)};
}
function preload(ctx){
  if(weak.has(ctx))return weak.get(ctx).promise;
  const data=root.OffbeatStudioBassSamples||{};
  const state={sounds:{},promise:null,ready:false};
  weak.set(ctx,state);
  state.promise=Promise.all(Object.keys(roots).map(async name=>{
    if(!data[name])return;
    try{
      const binary=atob(data[name]),bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      const decoded=await ctx.decodeAudioData(bytes.buffer);
      const details=analyze(decoded);
      if(details.rms>.0008&&decoded.duration>.35)state.sounds[name]=details;
    }catch(e){/* Keep other notes; fallback synthesizer remains available. */}
  })).then(()=>{
    state.ready=Object.keys(state.sounds).length>=3;
    return state.ready;
  });
  return state.promise;
}
function ready(ctx){const s=weak.get(ctx);return !!(s&&s.ready)}
function play(ctx,out,when,p,b,character){
  const state=weak.get(ctx),entry=choose(pickNote(p),state&&state.sounds||{});
  // Never pretend a model is a recording; this is an explicit fallback on failure.
  if(!entry)return root.OffbeatPluck.play(ctx,out,when,p,b,character);
  const at=Math.max(ctx.currentTime||0,when),bright=clamp(b,0,1),drive=character==='edge',voice=entry.source,notesources=[],gains=[];
  const source=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter(),env=ctx.createGain();
  source.buffer=voice.buffer;source.playbackRate.setValueAtTime(entry.rate,at);
  hp.type='highpass';hp.frequency.value=37;hp.Q.value=.6;
  lp.type='lowpass';lp.Q.value=.5;lp.frequency.value=(drive?1700:1150)+bright*(drive?2400:1050);
  let outNode=lp;
  source.connect(hp);hp.connect(lp);
  if(drive&&ctx.createWaveShaper){
    const dist=ctx.createWaveShaper(),curve=new Float32Array(512);
    for(let i=0;i<curve.length;i++){let x=i/255.5-1;curve[i]=Math.tanh(x*1.55)/Math.tanh(1.55)}
    dist.curve=curve;dist.oversample='2x';lp.connect(dist);outNode=dist;
  }
  outNode.connect(env);env.connect(out);
  let volume=clamp(voice.norm*(drive?.78:.88),.12,2.5);
  env.gain.setValueAtTime(.0001,at);
  env.gain.linearRampToValueAtTime(volume,at+.006);
  env.gain.setValueAtTime(volume*.87,at+.09);
  env.gain.setTargetAtTime(.0001,at+.33,.18);
  const maxDuration=Math.max(.12,(voice.buffer.duration-voice.start)/entry.rate);
  const length=Math.min(.90,maxDuration-.005);
  source.start(at,voice.start);source.stop(at+length);
  notesources.push(source);gains.push(env);
  return {sources:notesources,gains,at,stopped:false,recorded:true,note:entry.name,playbackRate:entry.rate};
}
function kill(v,t){
  if(!v)return;
  if(!v.recorded){return root.OffbeatPluck.kill(v,t)}
  if(v.stopped)return;
  const at=Math.max(v.at+.001,t);v.stopped=true;
  v.gains.forEach(g=>{
    try{g.gain.cancelScheduledValues(at);g.gain.setTargetAtTime(.00001,at,.012)}catch(e){}
  });
  v.sources.forEach(s=>{try{s.stop(at+.075)}catch(e){}});
}
root.OffbeatStudioBass={preload,ready,play,kill,notes:notes.slice(),choose,analyze};
})(window);
