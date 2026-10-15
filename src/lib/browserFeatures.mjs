import { estimateFundamental } from './browserPitch.mjs';
// OFFBEAT deterministic, private browser DSP baseline. No models, no network.
const SR=11025, HOP=256, ENERGY_FRAME=256;
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
export const ANALYSIS_SAMPLE_RATE=SR;
export function analyzePCM({samples,originalSampleRate,originalChannels,originalMime,sourceSha256,sourceKind,durationSeconds}){
 const y=samples instanceof Float32Array?samples:new Float32Array(samples);
 if(!y.length||!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>60)throw Error('Choose an audio clip shorter than 60 seconds.');
 const started=Date.now(),duration=Math.min(durationSeconds,y.length/SR),nFrames=Math.ceil(y.length/HOP);
 const energy=new Float32Array(nFrames);let peak=0;
 for(let i=0;i<y.length;i++)peak=Math.max(peak,Math.abs(y[i]));
 for(let k=0;k<nFrames;k++){
  let sum=0;const a=k*HOP,b=Math.min(y.length,a+ENERGY_FRAME);
  for(let i=a;i<b;i++)sum+=y[i]*y[i];
  energy[k]=Math.sqrt(sum/Math.max(1,b-a));
 }
 const warnings=['On-device pitch estimates are uncalibrated; noisy humming and bass overtones can cause octave mistakes.'];
 const flags=['pitch_confidence_uncalibrated','browser_dsp_baseline'];
 if(peak>=.999){flags.push('clipped');warnings.push('Some audio reaches clipping level.');}
 if(peak<.003){flags.push('near_silent');warnings.push('The recording is nearly silent.');}
 const distribution=Array.from(energy).sort((a,b)=>a-b);
 const low=distribution[Math.floor(distribution.length*.12)]||0;
 const high=distribution[Math.floor(distribution.length*.88)]||0;
 const floor=Math.max(.003,Math.min(.025,low*1.7,high*.24));
 const rests=restIntervals(energy,floor,duration);
 const rise=[];for(let k=1;k<nFrames;k++)rise.push(Math.max(0,energy[k]-energy[k-1]));
 const positives=rise.filter(x=>x>.0003).sort((a,b)=>a-b);
 const prominent=positives[Math.floor(positives.length*.8)]||0;
 const limit=Math.max(.007,prominent*.65);
 const onsets=[];let last=-.12;
 for(let k=2;k<rise.length-1;k++){
  const v=rise[k],t=(k+1)*HOP/SR;
  if(v>limit&&v>=rise[k-1]&&v>rise[k+1]&&energy[k+1]>floor*1.8&&t-last>.09){
   onsets.push({t_s:+Math.min(duration,t).toFixed(4),strength:+Math.min(1,v/Math.max(.015,peak*.22)).toFixed(4)});last=t;
  }
 }
 const pitch_frames=[];let voicedCount=0;
 for(let k=0;k<nFrames;k+=2){
  const t=k*HOP/SR;if(t>duration)break;
  const estimate=energy[k]>floor*1.25?estimateFundamental(y,k*HOP,SR):null;
  const good=estimate&&estimate.periodicity>=.75;
  if(good)voicedCount++;
  pitch_frames.push({t_s:+t.toFixed(4),
   hz:good?+estimate.hz.toFixed(3):null,
   confidence:good?+Math.min(.89,Math.max(.45,estimate.periodicity*.82)).toFixed(4):0,
   voiced:!!good});
 }
 // One-frame octave glitches read as phantom notes. Remove only isolated
 // jumps, never overwrite the surrounding pitched material or silence.
 let isolatedOctaves=0;
 for(let i=1;i<pitch_frames.length-1;i++){
  const p=pitch_frames[i-1],c=pitch_frames[i],n=pitch_frames[i+1];
  if(!p.voiced||!c.voiced||!n.voiced)continue;
  const neighborGap=Math.abs(12*Math.log2(p.hz/n.hz));
  const jump=Math.abs(12*Math.log2(c.hz/Math.sqrt(p.hz*n.hz)));
  if(neighborGap<2&&jump>8){
   c.hz=null;c.confidence=0;c.voiced=false;voicedCount--;isolatedOctaves++;
  }
 }
 if(isolatedOctaves){flags.push('isolated_octave_outliers');warnings.push('Brief ambiguous octave jumps were omitted from the contour.');}
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
  processing:{analysis_sample_rate_hz:SR,timebase:'source_start_seconds',analyzer_version:'0.1.1-browser',pitch_adapter:'browser_yin_cmnd_v2',pitch_model_version:'dsp-v1',onset_adapter:'browser_short_window_energy_v2',config_hash:'5645e9549d8f7a5dbf4c714d83e96a35b1f85c9761c23572924101b143e6f8c2',duration_ms:Date.now()-started},
  pitch_frames,onsets,rests,phrases,quality_flags:flags,warnings,
 };
}
