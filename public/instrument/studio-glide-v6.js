/* OFFBEAT / FORM 006 — expressively bending real electric-bass recordings.
 * No continuous oscillator. A note begins with its recorded attack, follows
 * the finger with small sample playback-rate bends, and crossfades between
 * nearby recorded notes for larger movement instead of chipmunk resampling.
 * Attribution for recordings is in studio-bass-samples-v5.js.
 */
(function(root){
'use strict';
const studio=()=>root.OffbeatStudioBass;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const frequency=p=>65.406*Math.pow(2,1.59*clamp(p,0,1));
function playableEntries(ctx){
  const stored=studio().decoded(ctx);
  return stored||{};
}
function tone(ctx,dest,at,entry,freq,brightness,character,transition){
  const details=entry.source;
  const base=studio().roots[entry.name];
  const src=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),
        lp=ctx.createBiquadFilter(),gain=ctx.createGain();
  src.buffer=details.buffer;
  const rate=clamp(freq/base,.66,1.48);
  src.playbackRate.setValueAtTime(rate,at);
  hp.type='highpass';hp.frequency.value=35;hp.Q.value=.5;
  lp.type='lowpass';lp.Q.value=.45;
  const edge=character==='edge';
  const cutoff=(edge?1280:850)+clamp(brightness,0,1)*(edge?2000:1150);
  lp.frequency.setValueAtTime(cutoff,at);
  src.connect(hp);hp.connect(lp);lp.connect(gain);gain.connect(dest);
  const level=clamp(details.norm*(edge?.68:.76),.13,1.45);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.linearRampToValueAtTime(level*(transition?.66:1),at+(transition?.065:.014));
  // Sound blooms then decays like a string, even if finger remains stationary.
  gain.gain.setTargetAtTime(level*.34,at+(transition?.19:.28),.58);
  const start=Math.max(0,details.start+(transition?.065:0));
  const available=Math.max(.1,(details.buffer.duration-start)/rate);
  const lifetime=Math.max(.12,Math.min(4.0,available-.015));
  src.start(at,start);
  src.stop(at+lifetime);
  return {source:src,gain,filter:lp,base,root:entry.name,when:at,
          lifetime,level,stopped:false};
}
function fadePart(part,at,fast){
  if(!part||part.stopped)return;
  part.stopped=true;
  const t=Math.max(part.when+.008,at);
  part.gain.gain.cancelScheduledValues(t);
  part.gain.gain.setTargetAtTime(.0001,t,fast?.018:.042);
  try{part.source.stop(t+(fast?.09:.20))}catch(e){}
}
function create(ctx,dest,at,p,b,character){
  const target=frequency(p),entries=playableEntries(ctx);
  const choice=studio().choose(target,entries);
  if(!choice){
    // Explicit failure fallback; this should not run after normal audio unlock.
    const v=root.OffbeatBass.create(ctx,dest,at,p,b,'hold',character,'glide');
    v.glidingFallback=true;
    return v;
  }
  const when=Math.max(ctx.currentTime||0,at);
  const part=tone(ctx,dest,when,choice,target,b,character,false);
  return {kind:'sample-glide',ctx,dest,character,parts:[part],current:part,
          stopped:false,on:when,lastChange:when,target,brightness:b};
}
function move(v,time,p,b){
  if(!v||v.stopped)return;
  if(v.glidingFallback)return root.OffbeatBass.move(v,time,p,b);
  const at=Math.max(v.on,time),target=frequency(p),entries=playableEntries(v.ctx);
  const next=studio().choose(target,entries);
  const old=v.current;
  if(!old||!next)return;
  // Switch root only if it noticeably reduces resampling distortion.
  // Wait 120ms between root changes; the bends themselves respond immediately.
  const oldError=Math.abs(12*Math.log2(target/old.base));
  const newError=Math.abs(12*Math.log2(target/studio().roots[next.name]));
  const shouldSwap=next.name!==old.root&&oldError>2.8&&newError+.8<oldError&&at-v.lastChange>.12;
  if(shouldSwap){
    const nextPart=tone(v.ctx,v.dest,at,next,target,b,v.character,true);
    // Envelope crossfade is click-free; the replacement skips the pluck transient.
    fadePart(old,at,false);
    v.parts.push(nextPart);v.current=nextPart;v.lastChange=at;
    if(v.parts.length>10)v.parts=v.parts.slice(-10);
  }else{
    const rate=clamp(target/old.base,.66,1.48);
    old.source.playbackRate.setTargetAtTime(rate,at,.026);
    const cutoff=(v.character==='edge'?1280:850)+clamp(b,0,1)*(v.character==='edge'?2000:1150);
    old.filter.frequency.setTargetAtTime(cutoff,at,.045);
  }
  v.target=target;v.brightness=b;
}
function stop(v,when){
  if(!v||v.stopped)return;
  if(v.glidingFallback)return root.OffbeatBass.stop(v,when);
  v.stopped=true;
  v.parts.forEach(part=>fadePart(part,Math.max(when,v.on),false));
}
function kill(v,when){
  if(!v)return;
  if(v.glidingFallback)return root.OffbeatBass.kill(v,when);
  v.stopped=true;v.parts.forEach(part=>fadePart(part,Math.max(when,v.on),true));
}
root.OffbeatStudioGlide={create,move,stop,kill,frequency};
})(window);