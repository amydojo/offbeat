import React, { useEffect, useRef, useState } from 'react';
import { playLoop, stopLoop, stopAll } from './lib/audioEngine.js';
import { createMicrophoneRecorder } from './audio/microphoneRecorder.js';
import { analyzeClip } from './lib/analysisClient.js';
import Contour from './components/Contour.jsx';
import drums from '../loop1.mp3';
import bass from '../loop2.mp3';
import melody from '../loop3.mp3';

const samples = [
  { id: 'drums', name: 'Drums', url: drums },
  { id: 'bass', name: 'Bass', url: bass },
  { id: 'melody', name: 'Melody', url: melody },
];
const allowedExtensions = /\.(wav|mp3|m4a|aac|flac|webm|ogg)$/i;
const MAX_BYTES = 25 * 1024 * 1024;

function ClipLane({ title, description, clip, onFile, onClear, onAnalyze, analyzing, kind }) {
  const input = useRef(null);
  return <section className="lane">
    <div className="lane-heading"><div><p className="eyebrow">{title}</p><p className="hint">{description}</p></div><span className="lane-index">{kind === 'solo_bass' ? '02' : '01'}</span></div>
    {clip ? <div className="clip"><div><strong>{clip.name}</strong><small>{(clip.file.size / 1024 / 1024).toFixed(2)} MB · {clip.file.type || 'unknown media type'}</small></div>
      <button className="text-button" onClick={onClear} type="button">Remove</button></div> : <button className="upload" onClick={() => input.current?.click()} type="button">+ Choose audio file</button>}
    <input ref={input} className="sr-only" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.webm,.ogg" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value=''; }} />
    {clip && <div className="lane-actions"><audio controls preload="metadata" src={clip.url} aria-label={title + ' audio playback'} /><button className="button-quiet" onClick={onAnalyze} disabled={analyzing}>{analyzing ? 'Listening…' : clip.analysis ? 'Analyze again' : 'Analyze shape'}</button></div>}
    {clip?.analysis && <Contour analysis={clip.analysis} label={title} />}
  </section>;
}

export default function App() {
  const [loops, setLoops] = useState({});
  const [reference, setReference] = useState(null);
  const [take, setTake] = useState(null);
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState('');
  const recorder = useRef(null);
  const micRequestPending = useRef(false);
  const mounted = useRef(false);
  const referenceRef = useRef(null);
  const takeRef = useRef(null);
  const jobs = useRef(new Map());

  // Unmount disposes audio players and permission handles. URLs are revoked once.
  useEffect(() => { referenceRef.current = reference; }, [reference]);
  useEffect(() => { takeRef.current = take; }, [take]);
  useEffect(() => {
    mounted.current = true;
    return () => {
    mounted.current = false;
    stopAll();
    recorder.current?.cancel();
    jobs.current.forEach(c => c.abort());
    if (referenceRef.current) URL.revokeObjectURL(referenceRef.current.url);
    if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
    };
  }, []);

  const toggleLoop = async s => {
    if (loops[s.id]) { stopLoop(s.id); setLoops(prev => ({ ...prev, [s.id]: false })); return; }
    try { await playLoop(s.id, s.url); setLoops(prev => ({ ...prev, [s.id]: true })); setMessage(''); }
    catch (error) { setMessage(error.message); }
  };
  const setClip = (lane, file) => {
    if (file.size > MAX_BYTES || !file.size || !(file.type.startsWith('audio/') || allowedExtensions.test(file.name))) {
      setMessage('Choose a supported audio file under 25 MB.'); return;
    }
    jobs.current.get(lane)?.abort(); jobs.current.delete(lane);
    const setter = lane === 'reference' ? setReference : setTake;
    const handle = lane === 'reference' ? referenceRef : takeRef;
    if (handle.current) URL.revokeObjectURL(handle.current.url);
    const next = { file, name: file.name, url: URL.createObjectURL(file), analysis: null };
    handle.current = next;
    setter(next);
    setBusy(prev => ({ ...prev, [lane]: false }));
    setMessage('');
  };
  const clearClip = lane => {
    jobs.current.get(lane)?.abort(); jobs.current.delete(lane);
    const setter = lane === 'reference' ? setReference : setTake;
    const handle = lane === 'reference' ? referenceRef : takeRef;
    if (handle.current) URL.revokeObjectURL(handle.current.url);
    handle.current = null;
    setter(null);
    setBusy(prev => ({ ...prev, [lane]: false }));
  };
  const analyze = async (lane, clip, sourceKind) => {
    if (!clip) return;
    const controller = new AbortController();
    jobs.current.get(lane)?.abort(); jobs.current.set(lane, controller);
    setBusy(prev => ({ ...prev, [lane]: true })); setMessage('');
    try {
      const result = await analyzeClip(clip.file, sourceKind, controller.signal);
      if (jobs.current.get(lane) !== controller) return;
      const setter = lane === 'reference' ? setReference : setTake;
      setter(prev => prev?.file === clip.file ? { ...prev, analysis: result } : prev);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
    } finally {
      if (jobs.current.get(lane) === controller) {
        jobs.current.delete(lane); setBusy(prev => ({ ...prev, [lane]: false }));
      }
    }
  };
  const startRecording = async () => {
    if (micRequestPending.current || recorder.current) return;
    micRequestPending.current = true;
    setRequestingMic(true);
    try {
      const active = await createMicrophoneRecorder();
      if (!mounted.current) { active.cancel(); return; }
      recorder.current = active;
      setRecording(true);
      setMessage('Recording your bass. Press Stop when you are done.');
    } catch (error) {
      if (mounted.current) { setRecording(false); setMessage(error.message); }
    } finally {
      micRequestPending.current = false;
      if (mounted.current) setRequestingMic(false);
    }
  };
  const stopRecording = async () => {
    const active = recorder.current;
    if (!active) return;
    recorder.current = null; setRecording(false);
    try {
      const blob = await active.stop();
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('webm') ? 'webm' : 'audio';
      setClip('take', new File([blob], `offbeat-take-${Date.now()}.${ext}`, { type: blob.type }));
    } catch (error) { setMessage(error.message); }
  };

  return <main className="shell">
    <header className="topbar"><strong>OFFBEAT<span className="mark">◦</span></strong><span>AN INSTRUMENT FOR LISTENING TO YOURSELF</span><span>ALPHA / 0.1</span></header>
    <section className="hero">
      <p className="eyebrow">01 / MIRROR INSTRUMENT</p>
      <h1>Hear what your hands remembered.</h1>
      <p>Record a phrase. See its movement, attacks, and silences. No scores, no wrong notes, no notation required.</p>
    </section>
    <div className="workspace">
      <ClipLane title="Reference" description="A solo bass stem, humming, or another short example." clip={reference} onFile={f => setClip('reference', f)} onClear={() => clearClip('reference')} onAnalyze={() => analyze('reference', reference, 'separated_stem')} analyzing={busy.reference} kind="separated_stem" />
      <ClipLane title="Your take" description="Play into the microphone or upload a recording." clip={take} onFile={f => setClip('take', f)} onClear={() => clearClip('take')} onAnalyze={() => analyze('take', take, 'solo_bass')} analyzing={busy.take} kind="solo_bass" />
      <div className="record-row"><button className={recording ? 'button-record active' : 'button-record'} type="button" disabled={requestingMic} onClick={recording ? stopRecording : startRecording}>{requestingMic ? 'Waiting for microphone…' : recording ? '■ Stop recording' : '● Record bass'}</button><p>Microphone access is requested only when you press Record. Local Python analysis never uploads your audio to the cloud.</p></div>
      {reference?.analysis && take?.analysis && <div className="insight"><p className="eyebrow">TWO PHRASES, TWO SHAPES</p><p>These contours preserve each recording's original timing. A/B alignment and phrase selection are coming in the next build gate.</p></div>}
      {message && <p className="status" role="status">{message}</p>}
    </div>
    <section className="samples"><div><p className="eyebrow">02 / ORIGINAL PLAYGROUND</p><h2>Three sounds, one loop at a time.</h2></div><div className="sample-list">{samples.map(s => <button key={s.id} onClick={() => toggleLoop(s)} className={loops[s.id] ? 'sample on' : 'sample'} aria-pressed={!!loops[s.id]}><span>{s.name}</span><span>{loops[s.id] ? '■ Stop' : '▶ Play'}</span></button>)}</div></section>
    <footer>OFFBEAT · Local first · The source is yours.</footer>
  </main>;
}
