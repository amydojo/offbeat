// FORM 007 — Web Audio transport for deterministic Groove Frame.
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
function composer(ctx){
 const master=ctx.createGain();
 master.gain.value=.82;
 const limiter=ctx.createDynamicsCompressor();
 limiter.threshold.value=-10;limiter.knee.value=9;limiter.ratio.value=3.2;
 limiter.attack.value=.003;limiter.release.value=.16;
 master.connect(limiter);limiter.connect(ctx.destination);
 const bass=ctx.createGain(),drums=ctx.createGain(),harmony=ctx.createGain();
 bass.gain.value=.7;drums.gain.value=.63;harmony.gain.value=.55;
 bass.connect(master);drums.connect(master);harmony.connect(master);
 return {master,bass,drums,harmony};
}
function pad(ctx,output,e,time){
 const f=e.frequency,ends=Math.min(.9,Math.max(.12,e.duration)),v=e.velocity;
 const amp=ctx.createGain(),lp=ctx.createBiquadFilter();
 lp.type='lowpass';lp.frequency.value=1250;lp.Q.value=.4;
 amp.gain.setValueAtTime(.0001,time);
 amp.gain.linearRampToValueAtTime(v*.60,time+.07);
 amp.gain.setValueAtTime(v*.60,time+Math.max(.08,ends-.13));
 amp.gain.exponentialRampToValueAtTime(.0001,time+ends);
 lp.connect(amp);amp.connect(output);
 const tones=[{ratio:1,level:.76,type:'sine'},{ratio:2,level:.19,type:'triangle'}];
 for(const t of tones){
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=t.type;osc.frequency.setValueAtTime(f*t.ratio,time);
   gain.gain.value=t.level;osc.connect(gain);gain.connect(lp);
   osc.start(time);osc.stop(time+ends+.012);
 }
}
export class FrameAudio{
 constructor({onLoop,onState,onProgress}={}){
   this.ctx=null;this.mix=null;this.running=false;this.audioReady=false;
   this.current=null;this.pending=null;this.loopStart=0;this.eventIndex=0;this.loopCount=0;
   this.timer=null;this.raf=0;this.onLoop=onLoop||(()=>{});this.onState=onState||(()=>{});
   this.onProgress=onProgress||(()=>{});
 }
 async ensureAudio(){
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)throw Error('Audio is not supported in this browser');
   if(!this.ctx){
     try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
     this.ctx=new Audio({latencyHint:'interactive'});this.mix=composer(this.ctx);
   }
   await this.ctx.resume();
   if(this.ctx.state!=='running')throw Error('Audio was blocked. Tap play again in Safari.');
   const sampled=window.OffbeatStudioBass;
   if(!sampled)throw Error('Bass samples did not load. Reload the page.');
   const ok=await sampled.preload(this.ctx);
   if(!ok)throw Error('Recorded bass could not be decoded on this device.');
   this.audioReady=true;return this.ctx;
 }
 async start(render){
   if(this.running){this.queue(render);return}
   const ctx=await this.ensureAudio();
   this.current=render;this.pending=null;this.running=true;this.loopCount=0;
   this.eventIndex=0;this.loopStart=ctx.currentTime+.085;
   this.onState({playing:true,ready:true});
   this.tick();
   this.timer=setInterval(()=>this.tick(),25);
   const animate=()=>{
     if(!this.running)return;
     const t=this.ctx.currentTime;
     const length=this.current.duration;
     const elapsed=t-this.loopStart;
     const phase=clamp(elapsed/length,0,1);
     this.onProgress(phase,this.loopCount);
     this.raf=requestAnimationFrame(animate);
   };
   this.raf=requestAnimationFrame(animate);
 }
 queue(render){this.pending=render;if(!this.running){this.current=render}}
 scheduleEvent(e,time){
   const ctx=this.ctx,mix=this.mix;
   if(e.kind==='bass'){
     if(e.free){
       const v=window.OffbeatStudioGlide.create(ctx,mix.bass,time,e.sampleP,.36,'warm');
       window.OffbeatStudioGlide.stop(v,time+Math.min(e.duration,.89));
     }else{
       window.OffbeatStudioBass.play(ctx,mix.bass,time,e.sampleP,.36,'warm');
     }
   }else if(e.kind==='harmony'){
     pad(ctx,mix.harmony,e,time);
   }else if(['kick','snare','hat'].includes(e.kind)){
     window.OffbeatRhythm.drum(ctx,mix.drums,e.kind,time,e.velocity);
   }
 }
 tick(){
   if(!this.running||!this.ctx)return;
   const ahead=this.ctx.currentTime+.145;
   let guard=0;
   while(this.running&&guard++<180){
     const events=this.current.events;
     if(this.eventIndex>=events.length){
       const next=this.loopStart+this.current.duration;
       if(next>ahead)break;
       this.loopStart=next;
       this.eventIndex=0;this.loopCount++;
       if(this.pending){this.current=this.pending;this.pending=null}
       this.onLoop(this.current,this.loopCount);
       continue;
     }
     const e=events[this.eventIndex],when=this.loopStart+e.time;
     if(when>ahead)break;
     this.eventIndex++;
     if(when<this.ctx.currentTime-.075)continue;
     this.scheduleEvent(e,Math.max(this.ctx.currentTime+.002,when));
   }
 }
 preview(e){
   if(!this.audioReady||!this.ctx||this.ctx.state!=='running'||!e)return;
   window.OffbeatStudioBass.play(this.ctx,this.mix.bass,this.ctx.currentTime+.008,e.sampleP,.28,'warm');
 }
 stop(){
   this.running=false;clearInterval(this.timer);this.timer=null;
   cancelAnimationFrame(this.raf);this.raf=0;
   if(this.mix&&this.ctx){
     const t=this.ctx.currentTime;
     this.mix.master.gain.cancelScheduledValues(t);
     this.mix.master.gain.setTargetAtTime(.0001,t,.012);
   }
   this.onProgress(0,0);this.onState({playing:false,ready:this.audioReady});
 }
 async resume(render){
   if(this.running){this.stop();return false}
   if(this.mix&&this.ctx){
     const t=this.ctx.currentTime;
     this.mix.master.gain.cancelScheduledValues(t);
     this.mix.master.gain.setValueAtTime(.82,t);
   }
   await this.start(render);return true;
 }
 async exportWav(render){
   const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
   if(!C)throw Error('Offline audio export is not available.');
   const sampleRate=44100,ctx=new C(1,Math.ceil((render.duration+.55)*sampleRate),sampleRate);
   const ok=await window.OffbeatStudioBass.preload(ctx);
   if(!ok)throw Error('Could not decode the bass samples for export.');
   const oldCtx=this.ctx,oldMix=this.mix;
   try{
     this.ctx=ctx;this.mix=composer(ctx);
     for(const event of render.events)this.scheduleEvent(event,.012+event.time);
   }finally{this.ctx=oldCtx;this.mix=oldMix}
   const audio=await ctx.startRendering(),samples=audio.getChannelData(0);
   const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
   const put=(p,text)=>{for(let i=0;i<text.length;i++)view.setUint8(p+i,text.charCodeAt(i))};
   put(0,'RIFF');view.setUint32(4,36+samples.length*2,true);
   put(8,'WAVE');put(12,'fmt ');view.setUint32(16,16,true);
   view.setUint16(20,1,true);view.setUint16(22,1,true);
   view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
   view.setUint16(32,2,true);view.setUint16(34,16,true);
   put(36,'data');view.setUint32(40,samples.length*2,true);
   for(let i=0;i<samples.length;i++){
     const v=clamp(samples[i],-1,1);
     view.setInt16(44+i*2,v<0?Math.round(v*32768):Math.round(v*32767),true);
   }
   return new Blob([bytes],{type:'audio/wav'});
 }
 async dispose(){
   this.stop();if(this.ctx){try{await this.ctx.close()}catch{}}this.ctx=null;
 }
}
export function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
