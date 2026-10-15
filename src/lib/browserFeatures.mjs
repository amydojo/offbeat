// OFFBEAT deterministic, private browser DSP baseline. No models, no network.
const SR=11025, HOP=256, FRAME=1024;
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];}
function restIntervals(energy,threshold,duration){
 const result=[];let begin=null;
 for(let i=0;i<=energy.length;i++){
  const quiet=i<energy.length&&energy[i]<threshold;
  if(quiet&&begin===null)begin=i*HOP/SR;
  if(begin!==null&&!quiet){
   const end=Math.min(duration,i*HOP/SR);
   if(end-begin>=.12)result.push({start_s:+begin.toFixed(4),end_s:+end.toFixed(4)});
   begin=null;
  }
 }
 return result;
}
function estimatePitch(y,center){
 const maxLag=Math.ceil(SR/36),minLag=Math.floor(SR/650);
 const start=Math.max(0,center-FRAME/2|0),size=FRAME-maxLag;
 if(start+FRAME+maxLag>=y.length)return null;
 let bestLag=0,best=-1;
 for(let lag=minLag;lag<=maxLag;lag+=2){
  let ab=0,aa=0,bb=0;
  for(let i=0;i<size;i+=3){const a=y[start+i],b=y[start+i+lag];ab+=a*b;aa+=a*a;bb+=b*b;}
  const c=ab/(Math.sqrt(aa*bb)+1e-12);
  if(c>best){best=c;bestLag=lag;}
 }
 return best>.76?SR/bestLag:null;
}
export const ANALYSIS_SAMPLE_RATE=SR;
export function analyzePCM({samples,originalSampleRate,originalChannels,originalMime,sourceSha256,sourceKind,durationSeconds}){
 const y=samples instanceof Float32Array?samples:new Float32Array(samples);
 if(!y.length||!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>60)throw Error('Choose an audio clip shorter than 60 seconds.');
 const started=Date.now(),duration=Math.min(durationSeconds,y.length/SR),nFrames=Math.ceil(y.length/HOP);
 const energy=new Float32Array(nFrames);let peak=0;
 for(let i=0;i<y.length;i++)peak=Math.max(peak,Math.abs(y[i]));
 for(let k=0;k<nFrames;k++){
  let sum=0;const a=k*HOP,b=Math.min(y.length,a+FRAME);
  for(let i=a;i<b;i++)sum+=y[i]*y[i];
  energy[k]=Math.sqrt(sum/Math.max(1,b-a));
 }
 const warnings=['On-device pitch tracking is approximate; low bass notes and noisy rooms can cause octave jumps.'];
 const flags=['pitch_confidence_uncalibrated','browser_dsp_baseline'];
 if(peak>=.999){flags.push('clipped');warnings.push('Some audio reaches clipping level.');}
 if(peak<.003){flags.push('near_silent');warnings.push('The recording is nearly silent.');}
 const floor=Math.max(.003,median(Array.from(energy))*.19);
 const rests=restIntervals(energy,floor,duration);
 const rise=[];for(let k=1;k<nFrames;k++)rise.push(Math.max(0,energy[k]-energy[k-1]));
 const positives=rise.filter(x=>x>.0003),limit=Math.max(.009,median(positives)*1.9);
 const onsets=[];let last=-.12;
 for(let k=2;k<rise.length-1;k++){
  const v=rise[k],t=(k+1)*HOP/SR;
  if(v>limit&&v>=rise[k-1]&&v>rise[k+1]&&t-last>.09){
   onsets.push({t_s:+Math.min(duration,t).toFixed(4),strength:+Math.min(1,v/Math.max(.015,peak*.22)).toFixed(4)});last=t;
  }
 }
 const pitch_frames=[];let voicedCount=0;
 for(let k=0;k<nFrames;k+=2){
  const t=k*HOP/SR;if(t>duration)break;
  const hz=energy[k]>=floor?estimatePitch(y,k*HOP):null;
  if(hz!==null)voicedCount++;
  pitch_frames.push({t_s:+t.toFixed(4),hz:hz===null?null:+hz.toFixed(3),confidence:hz===null?0:.55,voiced:hz!==null});
 }
 if(voicedCount<Math.max(3,pitch_frames.length*.15)){flags.push('limited_pitch_coverage');warnings.push('Not enough stable pitched sound for a full contour.');}
 const phrases=[];let cursor=0;
 for(const r of rests){
  if(r.start_s-cursor>=.2)phrases.push({start_s:+cursor.toFixed(4),end_s:r.start_s,method:'rest_boundary'});
  cursor=r.end_s;
 }
 if(duration-cursor>=.2)phrases.push({start_s:+cursor.toFixed(4),end_s:+duration.toFixed(4),method:'rest_boundary'});
 return {
  schema_version:'offbeat.phrase.v1',analysis_id:globalThis.crypto?.randomUUID?.()||String(Date.now()),
  source:{sha256:sourceSha256,kind:sourceKind,duration_s:+duration.toFixed(4),sample_rate_hz:originalSampleRate,channel_count:originalChannels,mime_type:originalMime||'application/octet-stream'},
  processing:{analysis_sample_rate_hz:SR,timebase:'source_start_seconds',analyzer_version:'0.1-browser',pitch_adapter:'browser_autocorrelation',pitch_model_version:'dsp-v1',onset_adapter:'browser_energy',config_hash:'0'.repeat(64),duration_ms:Date.now()-started},
  pitch_frames,onsets,rests,phrases,quality_flags:flags,warnings,
 };
}
