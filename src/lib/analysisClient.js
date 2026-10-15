import { ANALYSIS_SAMPLE_RATE } from './browserFeatures.mjs';
import { compareLocal } from './browserCompare.mjs';

const WORKER_URL = new URL('../workers/audioAnalysis.worker.js', import.meta.url);
const PYTHON_URL = 'http://127.0.0.1:8765';
const usePython = import.meta.env.VITE_ANALYSIS_MODE === 'python';
const aborted = () => new DOMException('Analysis canceled.', 'AbortError');
export const LONG_CLIP_EXCERPT_SECONDS = 55;

function ensureActive(signal){if(signal?.aborted)throw aborted();}

// Scan coarse 1-second energy bins and choose the first highest-energy
// 55-second window. This only chooses a time range; original bytes stay intact.
function activeWindowStart(decoded,windowSeconds,signal){
 const seconds=Math.ceil(decoded.duration),energy=new Float64Array(seconds);
 const first=decoded.getChannelData(0),step=128;
 for(let i=0;i<first.length;i+=step){
  if(i%524288===0)ensureActive(signal);
  const bucket=Math.min(seconds-1,Math.floor(i/decoded.sampleRate));
  energy[bucket]+=first[i]*first[i];
 }
 const maxStart=Math.max(0,Math.floor(decoded.duration-windowSeconds));
 const windowBins=Math.max(1,Math.round(windowSeconds));
 let sum=0,best=-1,start=0;
 for(let i=0;i<seconds;i++){
  sum+=energy[i];
  if(i>=windowBins)sum-=energy[i-windowBins];
  const current=i-windowBins+1;
  if(current>=0 && current<=maxStart && sum>best){best=sum;start=current;}
 }
 return start;
}
function downsample(decoded,signal,startSeconds,durationSeconds){
 const length=Math.max(1,Math.floor(durationSeconds*ANALYSIS_SAMPLE_RATE));
 const resampled=new Float32Array(length);
 const channels=decoded.numberOfChannels,ratio=decoded.sampleRate/ANALYSIS_SAMPLE_RATE;
 const startFrame=Math.round(startSeconds*decoded.sampleRate);
 const data=Array.from({length:channels},(_,i)=>decoded.getChannelData(i));
 for(let i=0;i<length;i++){
  if(i%4096===0)ensureActive(signal);
  const a=startFrame+i*ratio,b=Math.min(decoded.length,startFrame+(i+1)*ratio);
  let value=0,count=0;
  const begin=Math.floor(a),finish=Math.max(begin+1,Math.ceil(b));
  for(let j=begin;j<finish&&j<decoded.length;j++){
   for(const channel of data)value+=channel[j];count+=channels;
  }
  resampled[i]=count?value/count:0;
 }
 return resampled;
}
async function analyzeInBrowser(file,sourceKind,signal,requestedStart=null){
 ensureActive(signal);
 if(file.size>25*1024*1024||!file.size)throw Error('Choose an audio file under 25 MB.');
 if(typeof window.AudioContext==='undefined'&&typeof window.webkitAudioContext==='undefined')
  throw Error('This browser cannot decode audio for musical analysis.');
 const bytes=await file.arrayBuffer();ensureActive(signal);
 // Audio bytes are decoded and hashed on this device. No external request.
 const sha=await crypto.subtle.digest('SHA-256',bytes.slice(0));
 const hash=Array.from(new Uint8Array(sha),x=>x.toString(16).padStart(2,'0')).join('');
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 const context=new AudioCtx();
 let decoded;
 try {decoded=await context.decodeAudioData(bytes.slice(0));}
 catch {throw Error('Your browser cannot decode this format. Try a WAV, M4A or browser-recorded clip.');}
 finally {await context.close();}
 ensureActive(signal);
 if(!Number.isFinite(decoded.duration)||decoded.duration<.2)throw Error('The recording is too short to analyze.');
 const long=decoded.duration>60;
 const durationSeconds=long?LONG_CLIP_EXCERPT_SECONDS:decoded.duration;
 const maxStart=Math.max(0,decoded.duration-durationSeconds);
 const excerptStart=long
  ?(Number.isFinite(requestedStart)
    ?Math.max(0,Math.min(requestedStart,maxStart))
    :activeWindowStart(decoded,durationSeconds,signal))
  :0;
 const samples=downsample(decoded,signal,excerptStart,durationSeconds);ensureActive(signal);
 return new Promise((resolve,reject)=>{
  const worker=new Worker(WORKER_URL,{type:'module'});
  let settled=false;
  const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',onAbort);};
  const finish=(error,result)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(result);};
  const onAbort=()=>finish(aborted());
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted){onAbort();return;}
  worker.onerror=()=>finish(new Error('On-device analysis failed. Try a shorter recording.'));
  worker.onmessage=({data})=>{
   if(data?.error)finish(new Error(data.error));
   else if(data?.result?.schema_version==='offbeat.phrase.v1')finish(null,{analysis:data.result,excerptStart,fullDuration:decoded.duration});
   else finish(new Error('Analysis produced an unsupported feature format.'));
  };
  worker.postMessage({
   id:1,samples:samples.buffer,
   options:{originalSampleRate:decoded.sampleRate,originalChannels:decoded.numberOfChannels,
    originalMime:file.type||'application/octet-stream',sourceSha256:hash,sourceKind,durationSeconds:samples.length/ANALYSIS_SAMPLE_RATE}
  },[samples.buffer]);
 });
}
async function analyzeWithPython(file,sourceKind,signal){
 const form=new FormData();form.append('file',file,file.name||'recording');form.append('source_kind',sourceKind);
 let response;
 try {response=await fetch(PYTHON_URL+'/v1/audio/analyze',{method:'POST',headers:{'X-Offbeat-Client':'local-ui'},body:form,signal});}
 catch {throw Error('The optional local Python engine is unavailable. Switch to browser analysis to use Offbeat without a server.');}
 const data=await response.json();
 if(!response.ok)throw Error(data.error?.message||'Analysis failed.');
 if(data.schema_version!=='offbeat.phrase.v1')throw Error('Unsupported analysis schema.');
 return {analysis:data,excerptStart:0,fullDuration:data.source.duration_s};
}
export function analyzeClip(file,sourceKind,signal,requestedStart=null){
 return usePython&&requestedStart===null?analyzeWithPython(file,sourceKind,signal).catch(error=>{
  if(/60 seconds|too long|duration/i.test(error.message))return analyzeInBrowser(file,sourceKind,signal,requestedStart);
  throw error;
 }):analyzeInBrowser(file,sourceKind,signal,requestedStart);
}
export async function compareClips(reference,take,referenceRegion,signal){
 ensureActive(signal);
 if(!usePython){
  // Yield a frame so the UI can show the comparing state on small phones.
  await new Promise(resolve=>setTimeout(resolve,0));ensureActive(signal);
  return compareLocal(reference,take,{referenceRegion});
 }
 const response=await fetch(PYTHON_URL+'/v1/compare',{
  method:'POST',signal,headers:{'Content-Type':'application/json','X-Offbeat-Client':'local-ui'},
  body:JSON.stringify({reference,take,mode:'onsets',reference_region:referenceRegion})
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error?.message||'Comparison failed.');
 return data;
}
export const ANALYSIS_LOCATION=usePython?'local Python engine':'on this device';
