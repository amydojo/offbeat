/* OFFBEAT / Pitch Contour V2 — local, lightweight, confidence-gated bass note estimation.
 * Runs on an already decoded AudioBuffer; never uploads or stores original audio.
 * Intended for candidate ranking, NOT precise MIDI transcription.
 * YIN-style cumulative difference with 36–390 Hz bounds and octave-risk diagnostics.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.OffbeatPitchCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
function estimate(buffer,time,{fmin=36,fmax=390,threshold=.19}={}){
 const sr=buffer.sampleRate,ch=buffer.getChannelData(0),len=ch.length;
 if(!sr||!len)return null;
 const center=Math.round((time+.055)*sr),windowSize=Math.round(.165*sr);
 const start=clamp(center,0,Math.max(0,len-windowSize));
 const minLag=Math.max(2,Math.floor(sr/fmax)),maxLag=Math.min(Math.floor(sr/fmin),Math.floor(windowSize*.45));
 if(maxLag<=minLag||start+windowSize>len)return null;
 const stride=Math.max(1,Math.floor(sr/5000));
 let rms=0,count=0,dc=0;
 for(let i=start;i<start+windowSize;i+=stride){const v=ch[i];rms+=v*v;dc+=v;count++}
 rms=Math.sqrt(rms/Math.max(1,count));dc/=Math.max(1,count);
 if(rms<.0012)return null;
 const diffs=new Float32Array(maxLag+1),cmndf=new Float32Array(maxLag+1);
 const samples=Math.min(windowSize-maxLag,Math.round(sr*.10));
 for(let tau=1;tau<=maxLag;tau++){
  let sum=0;
  for(let n=0;n<samples;n+=stride){
   const v=ch[start+n]-ch[start+n+tau];sum+=v*v;
  }
  diffs[tau]=sum;
 }
 let cumulative=0;cmndf[0]=1;
 for(let tau=1;tau<=maxLag;tau++){
  cumulative+=diffs[tau];
  cmndf[tau]=cumulative>1e-10?diffs[tau]*tau/cumulative:1;
 }
 let best=-1,minimum=Infinity;
 for(let tau=minLag;tau<=maxLag;tau++){
  const v=cmndf[tau];
  if(v<minimum){minimum=v;best=tau}
  if(v<threshold){
   while(tau+1<=maxLag&&cmndf[tau+1]<v){tau++}
   best=tau;break;
  }
 }
 if(best<1)return null;
 // Parabolic interpolation for sub-sample pitch.
 const left=cmndf[Math.max(1,best-1)],here=cmndf[best],right=cmndf[Math.min(maxLag,best+1)];
 const denom=left+right-2*here;
 const shift=Math.abs(denom)>1e-7?clamp((left-right)/(2*denom),-.5,.5):0;
 const freq=sr/(best+shift),confidence=clamp(1-cmndf[best],0,1);
 const midi=69+12*Math.log2(freq/440);
 if(freq<fmin*.98||freq>fmax*1.02||confidence<.43)return null;
 // If the double period also has a strong dip, the octave is ambiguous.
 const twice=best*2;
 const octaveRisk=twice<=maxLag&&cmndf[twice]<cmndf[best]+.075;
 return {time,frequency:+freq.toFixed(1),midi:+midi.toFixed(2),confidence:+confidence.toFixed(3),octaveRisk,rms};
}
function phrase(buffer,attacks,start,{duration=4.8,maxNotes=12}={}){
 const times=(attacks||[]).map(a=>typeof a==='number'?a:a.time)
  .filter(t=>Number.isFinite(t)&&t>=start&&t<start+duration)
  .slice(0,maxNotes);
 const notes=[];
 for(const t of times){
  const candidates=[estimate(buffer,t),estimate(buffer,t+.045)].filter(Boolean);
  if(!candidates.length)continue;
  const best=candidates.sort((a,b)=>b.confidence-a.confidence)[0];
  if(best.confidence<.61)continue;
  notes.push({...best,time:t,position:(t-start)/duration});
 }
 return notes;
}
function interpolate(values,n=7){
 if(!values.length)return [];
 if(values.length===1)return Array(n).fill(values[0]);
 return Array.from({length:n},(_,j)=>{
  const x=j*(values.length-1)/(n-1),i=Math.floor(x),t=x-i;
  return values[i]*(1-t)+values[Math.min(values.length-1,i+1)]*t;
 });
}
function compareNotes(a,b){
 if(a.length<3||b.length<3)return {available:false,score:null,reason:'insufficient_confident_notes'};
 if(Math.min(a.length,b.length)/Math.max(a.length,b.length)<.55)
  return {available:false,score:null,reason:'different_attack_density'};
 const midsA=a.map(v=>v.midi),midsB=b.map(v=>v.midi);
 const ia=interpolate(midsA),ib=interpolate(midsB);
 // Normalize starting pitch: identical contours transposed to another key remain comparable.
 const ca=ia.map(x=>x-ia[0]),cb=ib.map(x=>x-ib[0]);
 const meanAbs=ca.reduce((s,v,i)=>s+Math.min(12,Math.abs(v-cb[i])),0)/ca.length;
 const intervals=x=>x.slice(1).map((v,i)=>v-x[i]);
 const da=intervals(ia),db=intervals(ib);
 const direction=da.reduce((s,v,i)=>s+(Math.sign(v)===Math.sign(db[i])?1:Math.abs(v)<.6&&Math.abs(db[i])<.6?1:0),0)/da.length;
 const conf=median([...a,...b].map(x=>x.confidence));
 const risk=[...a,...b].filter(x=>x.octaveRisk).length/Math.max(1,a.length+b.length);
 const raw=.74*Math.exp(-meanAbs/4)+.26*direction;
 // No fabricated certainty: risky octave estimates limit score and label.
 const score=clamp(raw*(1-.27*risk),0,1);
 return {available:true,score:+score.toFixed(3),meanAbsSemitones:+meanAbs.toFixed(2),
   direction:+direction.toFixed(3),confidence:+conf.toFixed(3),octaveRisk:+risk.toFixed(3),
   shiftSemitones:+(median(midsB)-median(midsA)).toFixed(1),notesA:a.length,notesB:b.length,
   reason:risk>.35?'octave_ambiguity':'measured'};
}
function comparePair(buffer,attacks,pair){
 const a=phrase(buffer,attacks,pair.a,{duration:pair.window||4.8});
 const b=phrase(buffer,attacks,pair.b,{duration:pair.window||4.8});
 return {...compareNotes(a,b),contourA:a.map(v=>({time:v.time,relative:v.midi-a[0].midi,confidence:v.confidence})),
   contourB:b.map(v=>({time:v.time,relative:v.midi-b[0].midi,confidence:v.confidence}))};
}
return Object.freeze({estimate,phrase,compareNotes,comparePair,interpolate});
});