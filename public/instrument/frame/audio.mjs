// FORM 007 — Web Audio transport for deterministic Groove Frame.
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
function composer(ctx){
 const master=ctx.createGain();
 master.gain.value=.82;
 const limiter=ctx.createDynamicsCompressor();
 limiter.threshold.value=-10;limiter.knee.value=9;limiter.ratio.value=3.2;
 limiter.attack.value=.003;limiter.release.value=.16;
 // Route output THROUGH the meter, not into an unconnected side branch.
 // This tells us whether browser audio is actually producing a signal.
 const analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.52;
 master.connect(limiter);limiter.connect(analyser);analyser.connect(ctx.destination);
 const bass=ctx.createGain(),drums=ctx.createGain(),harmony=ctx.createGain();
 bass.gain.value=.7;drums.gain.value=.63;harmony.gain.value=.55;
 bass.connect(master);drums.connect(master);harmony.connect(master);
 return {master,bass,drums,harmony,analyser};
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
   this.timer=null;this.raf=0;this.sculptVoice=null;this.sculptBus=null;this.sculptLast=null;this.onLoop=onLoop||(()=>{});this.onState=onState||(()=>{});
   this.onProgress=onProgress||(()=>{});
   this._meterData=null;
 }
 openContext(){
   if(this.ctx)return this.ctx;
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)throw Error('Web Audio is unavailable in this browser.');
   try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
   try{this.ctx=new Audio({latencyHint:'interactive'})}
   catch{this.ctx=new Audio()}
   this.mix=composer(this.ctx);
   // Start an inaudible buffer *synchronously* inside the user's first
   // pointer or button gesture. iOS Safari otherwise can appear to start
   // after its sample-decode promise has already expired user activation.
   try{
     const source=this.ctx.createBufferSource();
     source.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);
     source.connect(this.mix.master);source.start(0);
   }catch{}
   return this.ctx;
 }
 async ensureAudio(){
   const ctx=this.openContext();
   // Call resume before the first await: the user activation must still be
   // available at the instant the AudioContext is resumed on iOS/WebKit.
   if(ctx.state!=='running')await ctx.resume();
   if(ctx.state!=='running')throw Error('Audio is suspended. Tap Sound Check to unlock your speaker.');
   const sampled=window.OffbeatStudioBass;
   if(!sampled)throw Error('Bass library unavailable. Reload this page.');
   const ok=await sampled.preload(ctx);
   if(!ok)throw Error('Bass recordings could not decode. Use Sound Check and reload.');
   // iOS sometimes moves a live session to "interrupted" while decoding.
   if(ctx.state!=='running')await ctx.resume();
   if(ctx.state!=='running')throw Error('Audio interrupted. Tap Sound Check, then Play.');
   this.audioReady=true;return ctx;
 }
 signal(){
   if(!this.ctx||!this.mix?.analyser)return {state:'not_started',rms:0,peak:0};
   const a=this.mix.analyser;
   if(!this._meterData||this._meterData.length!==a.fftSize)this._meterData=new Float32Array(a.fftSize);
   if(typeof a.getFloatTimeDomainData==='function')a.getFloatTimeDomainData(this._meterData);
   else{
     const bytes=new Uint8Array(a.fftSize);a.getByteTimeDomainData(bytes);
     for(let i=0;i<bytes.length;i++)this._meterData[i]=(bytes[i]-128)/128;
   }
   let power=0,peak=0;
   for(const sample of this._meterData){power+=sample*sample;peak=Math.max(peak,Math.abs(sample))}
   return {state:this.ctx.state,rms:Math.sqrt(power/this._meterData.length),peak};
 }
 async soundCheck(){
   const ctx=this.openContext();
   // Audibly distinct from deep bass, so it can be heard on iPhone speakers
   // even when the fundamental electric-bass frequency is too low.
   const t=ctx.currentTime+.022,osc=ctx.createOscillator(),osc2=ctx.createOscillator(),
     envelope=ctx.createGain();
   osc.type='triangle';osc.frequency.setValueAtTime(392,t);
   osc2.type='sine';osc2.frequency.setValueAtTime(588,t);
   envelope.gain.setValueAtTime(.0001,t);
   envelope.gain.linearRampToValueAtTime(.40,t+.018);
   envelope.gain.setTargetAtTime(.0001,t+.31,.086);
   osc.connect(envelope);
   const overtone=ctx.createGain();overtone.gain.value=.15;
   osc2.connect(overtone);overtone.connect(envelope);
   envelope.connect(this.mix.master);
   osc.start(t);osc.stop(t+.65);
   osc2.start(t);osc2.stop(t+.65);
   // Must happen *on the click*; async decompression is intentionally absent.
   if(ctx.state!=='running')await ctx.resume();
   return ctx.state==='running';
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
       const v=window.OffbeatStudioBass.play(ctx,mix.bass,time,e.sampleP,.36,'warm');
       // Duration is an actual musical parameter, not just a decorative handle.
       // Samples remain one-shot but release according to the authored note length.
       window.OffbeatStudioBass.kill(v,time+Math.min(e.duration,.87));
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
 // The user's continuous movement bends a *real recorded string*. A local
 // preview bus remains separate from the loop, so the original is never edited.
 sculpt(height){
   if(!this.audioReady||!this.ctx||this.ctx.state!=='running')return false;
   const t=this.ctx.currentTime+.006,p=clamp(height,0,1);
   if(!this.sculptBus){
     this.sculptBus=this.ctx.createGain();this.sculptBus.gain.value=.64;
     this.sculptBus.connect(this.mix.master);
   }
   if(!this.sculptVoice){
     this.sculptVoice=window.OffbeatStudioGlide.create(this.ctx,this.sculptBus,t,p,.45,'warm');
     if(this.running){
       this.mix.bass.gain.setTargetAtTime(.24,t,.035);
       this.mix.drums.gain.setTargetAtTime(.42,t,.04);
       this.mix.harmony.gain.setTargetAtTime(.31,t,.04);
     }
   }else window.OffbeatStudioGlide.move(this.sculptVoice,t,p,.5);
   this.sculptLast=p;
   return true;
 }
 releaseSculpt(){
   if(!this.ctx||!this.sculptVoice)return;
   const t=this.ctx.currentTime+.006;
   window.OffbeatStudioGlide.stop(this.sculptVoice,t);
   this.sculptVoice=null;this.sculptLast=null;
   if(this.mix){
     this.mix.bass.gain.setTargetAtTime(.7,t,.065);
     this.mix.drums.gain.setTargetAtTime(.63,t,.065);
     this.mix.harmony.gain.setTargetAtTime(.55,t,.065);
   }
 }
 // A miniature "cause -> effect" audition: bass first, supporting harmony
 // enters a few milliseconds later. Both are deliberately foregrounded and
 // only temporary; rhythmic layout is updated at the next loop boundary.
 previewChange(render,id){
   if(!this.audioReady||!this.ctx||this.ctx.state!=='running'||!render)return false;
   const bass=render.bass.find(e=>e.sourceId===id);
   const harmony=render.harmony.find(e=>e.sourceId===id);
   const accent=render.drums.find(e=>e.derivedFromIds?.includes(id)&&e.reason?.includes('response'));
   const t=this.ctx.currentTime+.012;
   const bus=this.ctx.createGain();bus.gain.value=.73;bus.connect(this.mix.master);
   if(bass){
     const played=window.OffbeatStudioBass.play(this.ctx,bus,t,bass.sampleP,.46,'warm');
     window.OffbeatStudioBass.kill(played,t+.58);
   }
   if(harmony)pad(this.ctx,bus,{...harmony,velocity:.34,duration:.46},t+.055);
   if(accent)window.OffbeatRhythm.drum(this.ctx,bus,accent.kind,t+.35,.27);
   // Bus self-fades; no persistent preview routing.
   bus.gain.setValueAtTime(.73,t);
   bus.gain.setTargetAtTime(.0001,t+.63,.05);
   return true;
 }
 // Listen to the exact affected phrase in isolation, original then changed.
 // The existing full groove ducks temporarily; its transport never restarts.
 compareChange(before,after,id){
   if(!this.audioReady||!this.ctx||this.ctx.state!=='running')return false;
   this.releaseSculpt();
   const ctx=this.ctx,t=ctx.currentTime+.035,output=ctx.createGain();
   output.gain.setValueAtTime(.88,t);
   output.gain.setTargetAtTime(.0001,t+1.55,.045);
   output.connect(this.mix.master);
   const sources=[before,after];
   sources.forEach((render,index)=>{
     const time=t+index*.76;
     const bass=render.bass.find(e=>e.sourceId===id);
     const harmony=render.harmony.find(e=>e.sourceId===id);
     if(bass){
       const note=window.OffbeatStudioBass.play(ctx,output,time,bass.sampleP,.51,'warm');
       window.OffbeatStudioBass.kill(note,time+.54);
     }
     if(harmony)pad(ctx,output,{...harmony,velocity:.39,duration:.49},time+.075);
   });
   if(this.running){
     for(const [part,level] of [['bass',.7],['drums',.63],['harmony',.55]]){
       const param=this.mix[part].gain;
       param.cancelScheduledValues(t);
       param.setTargetAtTime(part==='drums'?.16:.23,t,.028);
       param.setTargetAtTime(level,t+1.57,.09);
     }
   }
   return true;
 }
 preview(e){
   if(!this.audioReady||!this.ctx||this.ctx.state!=='running'||!e)return;
   window.OffbeatStudioBass.play(this.ctx,this.mix.bass,this.ctx.currentTime+.008,e.sampleP,.28,'warm');
 }
 stop(){
   this.releaseSculpt();
   this.running=false;clearInterval(this.timer);this.timer=null;
   cancelAnimationFrame(this.raf);this.raf=0;
   if(this.mix&&this.ctx){
     const t=this.ctx.currentTime;
     this.mix.master.gain.cancelScheduledValues(t);
     this.mix.master.gain.setTargetAtTime(.0001,t,.012);
     // Stop the remaining scheduled loop tails, then reopen the output
     // after the lookahead window. Sculpt preview still works while paused.
     this.mix.master.gain.setTargetAtTime(.82,t+.24,.028);
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
