/* OFFBEAT / FORM BASS 003
   Physical-feeling, locally synthesized melodic bass.
   RIFF: pitch positions in D-minor pentatonic, with hysteresis and
   articulated note boundaries. GLIDE: expressive continuous bends.
   This is deterministic DSP, not a sampled instrument or AI inference. */
(function(root){
'use strict';
var NOTES=[73.416,87.307,97.999,110,130.813,146.832,174.614,195.998];
var clamp=function(n,a,b){return Math.max(a,Math.min(b,Number(n)||0));};
function noteIndex(p){return Math.max(0,Math.min(NOTES.length-1,Math.round(clamp(p,0,1)*(NOTES.length-1))))}
function riffFrequency(p){return NOTES[noteIndex(p)]}
function glideFrequency(p){return 65.406*Math.pow(2,1.59*clamp(p,0,1))}
function wave(c){
  if(typeof c.createWaveShaper!=='function')return null;
  var w=c.createWaveShaper(),curve=new Float32Array(1024);
  for(var i=0;i<curve.length;i++){
    var x=2*i/(curve.length-1)-1;
    curve[i]=Math.tanh(1.8*x)/Math.tanh(1.8);
  }
  w.curve=curve;w.oversample='2x';return w;
}
function ampAttack(node,harmNode,time,mode,pluck,brightness){
  var g=node.gain,at=Math.max(0,time),volume=mode==='edge'?.47:.51;
  g.cancelScheduledValues(at);
  g.setValueAtTime(.0001,at);
  g.linearRampToValueAtTime(volume*(pluck?1:.85),at+(pluck?.008:.014));
  g.exponentialRampToValueAtTime(volume*.43,at+(pluck?.18:.25));
  g.exponentialRampToValueAtTime(volume*.25,at+(pluck?.70:.85));
  // Front-load the upper partial: attack first, warm low-frequency body afterward.
  // This is what makes each note a pluck instead of a sustained nasal buzz.
  var h=harmNode.gain,top=(mode==='edge'?.32:.24)*(0.78+clamp(brightness,0,1)*.4);
  h.cancelScheduledValues(at);
  h.setValueAtTime(.055,at);
  h.linearRampToValueAtTime(top,at+.006);
  h.exponentialRampToValueAtTime(top*.45,at+.14);
  h.exponentialRampToValueAtTime(top*.27,at+.43);
}
function create(c,out,when,p,b,kind,character,gesture){
  var at=Math.max(0,when),isHit=kind==='hit',mode=character==='edge'?'edge':'warm';
  var motion=gesture==='riff'?'riff':'glide';
  var index=noteIndex(p),f=motion==='riff'?NOTES[index]:glideFrequency(p);
  var sub=c.createOscillator(),harm=c.createOscillator(),subGain=c.createGain(),harmGain=c.createGain();
  var filter=c.createBiquadFilter(),env=c.createGain(),drive=wave(c);
  sub.type='sine';harm.type=mode==='edge'?'sawtooth':'triangle';
  sub.frequency.setValueAtTime(f,at);
  harm.frequency.setValueAtTime(f*2,at);
  subGain.gain.value=.95;harmGain.gain.value=.055;
  filter.type='lowpass';filter.Q.value=.45;
  filter.frequency.setValueAtTime(330+clamp(b,0,1)*(mode==='edge'?1550:820),at);
  sub.connect(subGain);harm.connect(harmGain);
  subGain.connect(filter);harmGain.connect(filter);
  if(drive){filter.connect(drive);drive.connect(env)}else filter.connect(env);
  env.connect(out);
  ampAttack(env,harmGain,at,mode,true,b);
  if(isHit){env.gain.cancelScheduledValues(at+.26);env.gain.setTargetAtTime(.0001,at+.26,.047)}
  sub.start(at);harm.start(at);
  var v={o:sub,u:harm,g:env,h:harmGain,f:filter,mode:mode,gesture:motion,index:index,lastNoteAt:at,on:at,stopped:false,at:at,drive:drive};
  if(isHit){
    // Historical FORM 001 held notes are replayed as short, bassy hits.
    sub.stop(at+.62);harm.stop(at+.62);v.stopped=true;
  }
  return v;
}
function move(v,when,p,b){
  if(!v||v.stopped)return false;
  var t=Math.max(v.on,when),f;
  if(v.gesture==='riff'){
    var proposed=noteIndex(p),norm=clamp(p,0,1)*7;
    // 1.8% screen hysteresis, plus a 65 ms articulation debounce.
    if(proposed!==v.index&&t-v.lastNoteAt>=.065){
      var border=(proposed>v.index?v.index+.5:v.index-.5);
      if(proposed>v.index?norm>border+.13:norm<border-.13){
        v.index=proposed;v.lastNoteAt=t;
        ampAttack(v.g,v.h,t,v.mode,true,b);
      }
    }
    f=NOTES[v.index];
  }else{
    f=glideFrequency(p);
  }
  v.o.frequency.setTargetAtTime(f,t,v.gesture==='riff'?.018:.028);
  v.u.frequency.setTargetAtTime(f*2,t,v.gesture==='riff'?.018:.028);
  v.f.frequency.setTargetAtTime(330+clamp(b,0,1)*(v.mode==='edge'?1550:820),t,.045);
  return true;
}
function stop(v,when){
  if(!v||v.stopped)return;
  v.stopped=true;
  var t=Math.max(v.on+.005,when);
  v.g.gain.cancelScheduledValues(t);
  // Release from actual scheduled value avoids hard-cut pops.
  v.g.gain.setTargetAtTime(.0001,t,.025);
  try{v.o.stop(t+.16);v.u.stop(t+.16)}catch(ignore){}
}
function kill(v,when){
  if(!v)return;
  var t=Math.max(v.on+.005,when);
  try{v.g.gain.cancelScheduledValues(t);v.g.gain.setValueAtTime(.0001,t);v.o.stop(t+.006);v.u.stop(t+.006)}catch(ignore){}
  v.stopped=true;
}
root.OffbeatBass={create:create,move:move,stop:stop,kill:kill,notes:NOTES.slice(),noteIndex:noteIndex,riffFrequency:riffFrequency,glideFrequency:glideFrequency};
})(window);