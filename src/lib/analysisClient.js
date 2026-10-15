import { ANALYSIS_SAMPLE_RATE } from './browserFeatures.mjs';
import { compareLocal } from './browserCompare.mjs';

const WORKER_URL = new URL('../workers/audioAnalysis.worker.js', import.meta.url);
const PYTHON_URL = 'http://127.0.0.1:8765';
const usePython = import.meta.env.VITE_ANALYSIS_MODE === 'python';
const aborted = () => new DOMException('Analysis canceled.', 'AbortError');

function ensureActive(signal){if(signal?.aborted)throw aborted();}

function downsample(decoded,signal){
 const length=Math.ceil(decoded.duration*ANALYSIS_SAMPLE_RATE);
 const resampled=new Float32Array(length);
 const channels=decoded.numberOfChannels,ratio=decoded.sampleRate/ANALYSIS_SAMPLE_RATE;
 const data=Array.from({length:channels},(_,i)=>decoded.getChannelData(i));
 for(let i=0;i<length;i++){
  if(i%4096===0)ensureActive(signal);
  const a=i*ratio,b=Math.min(decoded.length,(i+1)*ratio);
  let value=0,count=0;
  const start=Math.floor(a),finish=Math.max(start+1,Math.ceil(b));
  for(let j=start;j<finish&&j<decoded.length;j++){
   for(const channel of data)value+=channel[j];count+=channels;
  }
  resampled[i]=count?value/count:0;
 }
 return resampled;
}
async function analyzeInBrowser(file,sourceKind,signal){
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
 if(decoded.duration>60.001)throw Error('Please choose an audio clip under 60 seconds.');
 const samples=downsample(decoded,signal);ensureActive(signal);
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
   else if(data?.result?.schema_version==='offbeat.phrase.v1')finish(null,data.result);
   else finish(new Error('Analysis produced an unsupported feature format.'));
  };
  worker.postMessage({
   id:1,samples:samples.buffer,
   options:{originalSampleRate:decoded.sampleRate,originalChannels:decoded.numberOfChannels,
    originalMime:file.type||'application/octet-stream',sourceSha256:hash,sourceKind,durationSeconds:decoded.duration}
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
 return data;
}
export function analyzeClip(file,sourceKind,signal){
 return usePython?analyzeWithPython(file,sourceKind,signal):analyzeInBrowser(file,sourceKind,signal);
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
