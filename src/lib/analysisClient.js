import { ANALYSIS_SAMPLE_RATE, analyzePCM } from './browserFeatures.mjs';
import { compareLocal } from './browserCompare.mjs';

const WORKER_URL = new URL('../workers/audioAnalysis.worker.js', import.meta.url);
const PYTHON_URL = 'http://127.0.0.1:8765';
const usePython = import.meta.env.VITE_ANALYSIS_MODE === 'python';
const aborted = () => new DOMException('Analysis canceled.', 'AbortError');
export const LONG_CLIP_EXCERPT_SECONDS = 55;
const CHUNK_SECONDS = 8;
const WORKER_TIMEOUT_MS = 18000;

function ensureActive(signal) { if (signal?.aborted) throw aborted(); }

// Select an energetic window without changing the original audio. The user
// can explicitly override the selected start in the Capture lane.
function activeWindowStart(decoded, windowSeconds, signal) {
  const seconds = Math.ceil(decoded.duration);
  const energy = new Float64Array(seconds);
  const channel = decoded.getChannelData(0);
  const step = 128;
  for (let i = 0; i < channel.length; i += step) {
    if (i % 524288 === 0) ensureActive(signal);
    const bucket = Math.min(seconds - 1, Math.floor(i / decoded.sampleRate));
    energy[bucket] += channel[i] * channel[i];
  }
  const maxStart = Math.max(0, Math.floor(decoded.duration - windowSeconds));
  const bins = Math.max(1, Math.round(windowSeconds));
  let sum = 0, best = -1, chosen = 0;
  for (let i = 0; i < seconds; i++) {
    sum += energy[i];
    if (i >= bins) sum -= energy[i - bins];
    const start = i - bins + 1;
    if (start >= 0 && start <= maxStart && sum > best) {
      best = sum;
      chosen = start;
    }
  }
  return chosen;
}

function downsample(decoded, signal, startSeconds, durationSeconds) {
  const length = Math.max(1, Math.floor(durationSeconds * ANALYSIS_SAMPLE_RATE));
  const resampled = new Float32Array(length);
  const channels = decoded.numberOfChannels;
  const ratio = decoded.sampleRate / ANALYSIS_SAMPLE_RATE;
  const startFrame = Math.round(startSeconds * decoded.sampleRate);
  const data = Array.from({length: channels}, (_, i) => decoded.getChannelData(i));
  for (let i = 0; i < length; i++) {
    if (i % 4096 === 0) ensureActive(signal);
    const a = startFrame + i * ratio;
    const b = Math.min(decoded.length, startFrame + (i + 1) * ratio);
    const begin = Math.floor(a), finish = Math.max(begin + 1, Math.ceil(b));
    let value = 0, count = 0;
    for (let j = begin; j < finish && j < decoded.length; j++) {
      for (const channel of data) { value += channel[j]; count++; }
    }
    resampled[i] = count ? value / count : 0;
  }
  return resampled;
}

// Workers are an optional performance enhancement. Some iOS Safari contexts
// reject module workers or fail while loading them; do not lose the recording.
function analyzeViaWorker(samples, options, signal) {
  ensureActive(signal);
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(WORKER_URL, {type: 'module'}); }
    catch (error) { reject(error); return; }
    let settled = false;
    let watchdog;
    const cleanup = () => {
      clearTimeout(watchdog);
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve(result);
    };
    const onAbort = () => finish(aborted());
    signal?.addEventListener('abort', onAbort, {once:true});
    if (signal?.aborted) { onAbort(); return; }
    worker.onerror = event => {
      event.preventDefault?.();
      finish(new Error('Audio worker unavailable on this browser.'));
    };
    worker.onmessageerror = () => finish(new Error('Audio worker returned unreadable data.'));
    worker.onmessage = ({data}) => {
      if (data?.error) finish(new Error(data.error));
      else if (data?.result?.schema_version === 'offbeat.phrase.v1') finish(null, data.result);
      else finish(new Error('Audio worker returned an invalid analysis.'));
    };
    watchdog = setTimeout(() => finish(new Error('Audio worker timed out.')), WORKER_TIMEOUT_MS);
    try { worker.postMessage({id:1,samples:samples.buffer,options}, [samples.buffer]); }
    catch (error) { finish(error); }
  });
}

const shift = (value, seconds) => +(value + seconds).toFixed(4);
function glueIntervals(intervals, gap=.075) {
  const out = [];
  for (const interval of intervals) {
    const prev = out[out.length - 1];
    if (prev && interval.start_s <= prev.end_s + gap) {
      prev.end_s = Math.max(prev.end_s, interval.end_s);
    } else out.push({...interval});
  }
  return out;
}

function mergeChunkAnalyses(chunks, duration, elapsedMs, workerFallback) {
  const first = chunks[0].analysis;
  if (chunks.length === 1 && !workerFallback) return first;
  const offsetItem = (item, offset) => ({...item, t_s: shift(item.t_s, offset)});
  const offsetRange = (item, offset) => ({
    ...item, start_s: shift(item.start_s, offset), end_s: shift(item.end_s, offset)
  });
  const all = {
    pitch_frames: [], onsets: [], rests: [], phrases: [],
    quality_flags: new Set(), warnings: new Set()
  };
  for (const {analysis,offset} of chunks) {
    all.pitch_frames.push(...analysis.pitch_frames.map(x => offsetItem(x, offset)));
    all.onsets.push(...analysis.onsets.map(x => offsetItem(x, offset)));
    all.rests.push(...analysis.rests.map(x => offsetRange(x, offset)));
    all.phrases.push(...analysis.phrases.map(x => offsetRange(x, offset)));
    analysis.quality_flags.forEach(x => all.quality_flags.add(x));
    analysis.warnings.forEach(x => all.warnings.add(x));
  }
  if (chunks.length > 1) all.quality_flags.add('chunked_mobile_analysis');
  if (workerFallback) {
    all.quality_flags.add('worker_fallback_main_thread');
    all.warnings.add('The browser worker was unavailable; analysis completed locally in small batches.');
  }
  return {
    ...first,
    analysis_id:crypto.randomUUID?.() || first.analysis_id,
    source:{...first.source,duration_s:+duration.toFixed(4)},
    processing:{...first.processing,duration_ms:elapsedMs,
      analyzer_version:'0.1.2-browser-chunked'},
    pitch_frames:all.pitch_frames,
    onsets:all.onsets,
    rests:glueIntervals(all.rests),
    phrases:glueIntervals(all.phrases),
    quality_flags:[...all.quality_flags],
    warnings:[...all.warnings]
  };
}

async function analyzeInBrowser(file, sourceKind, signal, requestedStart=null) {
  ensureActive(signal);
  if (!file.size || file.size > 25*1024*1024) throw Error('Choose an audio file under 25 MB.');
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw Error('This browser cannot decode audio for musical analysis.');
  const bytes = await file.arrayBuffer();
  ensureActive(signal);
  const sha = await crypto.subtle.digest('SHA-256', bytes.slice(0));
  const hash = Array.from(new Uint8Array(sha), x => x.toString(16).padStart(2,'0')).join('');
  const context = new AudioCtx();
  let decoded;
  try { decoded = await context.decodeAudioData(bytes.slice(0)); }
  catch { throw Error('Your browser cannot decode this format. Try a WAV, M4A or browser-recorded clip.'); }
  finally { await context.close(); }
  ensureActive(signal);
  if (!Number.isFinite(decoded.duration) || decoded.duration < .2)
    throw Error('The recording is too short to analyze.');
  const long = decoded.duration > 60;
  const durationSeconds = long ? LONG_CLIP_EXCERPT_SECONDS : decoded.duration;
  const maxStart = Math.max(0, decoded.duration - durationSeconds);
  const excerptStart = long
    ? (Number.isFinite(requestedStart)
      ? Math.max(0, Math.min(requestedStart, maxStart))
      : activeWindowStart(decoded, durationSeconds, signal))
    : 0;
  const startTime = Date.now();
  // Downsample just the analysis window, not the whole two-minute input.
  const samples = downsample(decoded, signal, excerptStart, durationSeconds);
  ensureActive(signal);
  // Avoid one 55-second YIN job that can exhaust a Safari worker's budget.
  const chunks = [];
  let workerUnavailable = typeof Worker === 'undefined';
  let usedFallback = false;
  for (let from = 0; from < samples.length; from += CHUNK_SECONDS * ANALYSIS_SAMPLE_RATE) {
    ensureActive(signal);
    const length = Math.min(CHUNK_SECONDS * ANALYSIS_SAMPLE_RATE, samples.length - from);
    const offset = from / ANALYSIS_SAMPLE_RATE;
    const chunkSamples = samples.slice(from, from + length);
    const options = {
      originalSampleRate:decoded.sampleRate, originalChannels:decoded.numberOfChannels,
      originalMime:file.type || 'application/octet-stream',
      sourceSha256:hash, sourceKind, durationSeconds:length / ANALYSIS_SAMPLE_RATE
    };
    let analysis;
    if (!workerUnavailable) {
      try { analysis = await analyzeViaWorker(chunkSamples.slice(), options, signal); }
      catch (error) {
        ensureActive(signal);
        workerUnavailable = true;
      }
    }
    if (!analysis) {
      usedFallback = true;
      // Give mobile Safari time to paint and handle touch interactions between
      // synchronous, bounded DSP slices; no network fallback or audio upload.
      await new Promise(resolve => setTimeout(resolve, 0));
      ensureActive(signal);
      analysis = analyzePCM({...options, samples:chunkSamples});
    }
    chunks.push({analysis,offset});
    if (from + length < samples.length) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const result = mergeChunkAnalyses(chunks, samples.length/ANALYSIS_SAMPLE_RATE,
    Date.now() - startTime, usedFallback);
  return {analysis:result,excerptStart,fullDuration:decoded.duration};
}

async function analyzeWithPython(file,sourceKind,signal) {
  const form=new FormData();form.append('file',file,file.name||'recording');form.append('source_kind',sourceKind);
  let response;
  try {response=await fetch(PYTHON_URL+'/v1/audio/analyze',{method:'POST',headers:{'X-Offbeat-Client':'local-ui'},body:form,signal});}
  catch {throw Error('The optional local Python engine is unavailable. Switch to browser analysis to use Offbeat without a server.');}
  const data=await response.json();
  if(!response.ok)throw Error(data.error?.message||'Analysis failed.');
  if(data.schema_version!=='offbeat.phrase.v1')throw Error('Unsupported analysis schema.');
  return {analysis:data,excerptStart:0,fullDuration:data.source.duration_s};
}
export function analyzeClip(file,sourceKind,signal,requestedStart=null) {
  return usePython && requestedStart===null
    ? analyzeWithPython(file,sourceKind,signal).catch(error=>{
      if(/60 seconds|too long|duration/i.test(error.message))
        return analyzeInBrowser(file,sourceKind,signal,requestedStart);
      throw error;
    })
    : analyzeInBrowser(file,sourceKind,signal,requestedStart);
}
export async function compareClips(reference,take,referenceRegion,signal) {
  ensureActive(signal);
  if(!usePython) {
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
