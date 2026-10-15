import React, { useEffect, useRef, useState } from 'react';
import { playLoop, stopLoop, stopAll } from './lib/audioEngine.js';
import { createMicrophoneRecorder } from './audio/microphoneRecorder.js';
import { analyzeClip, compareClips, ANALYSIS_LOCATION, LONG_CLIP_EXCERPT_SECONDS } from './lib/analysisClient.js';
import { selectableRange } from './lib/phraseRanges.mjs';
import { saveSession, listSessions, removeSession, clearSessions, restoreClip } from './lib/localLibrary.js';
import { downloadSessionBackup, parseSessionBackup } from './lib/sessionPortable.mjs';
import Contour from './components/Contour.jsx';
import MirrorCompare from './components/MirrorCompare.jsx';
import PhrasePlayer from './components/PhrasePlayer.jsx';
import ExcerptPicker from './components/ExcerptPicker.jsx';
import GrooveLab from './components/GrooveLab.jsx';
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

function microphoneFailure(error) {
  const type=error?.name;
  if(type==='NotAllowedError'||type==='PermissionDeniedError'||type==='SecurityError')
    return 'Microphone access was denied. Allow OFFBEAT to use your microphone in browser site settings, then tap Record or hum again.';
  if(type==='NotFoundError'||type==='DevicesNotFoundError')
    return 'No microphone was found. Connect a microphone or check your device audio settings.';
  if(type==='NotReadableError'||type==='TrackStartError'||type==='AbortError')
    return 'The microphone may be in use by another app. Close other recording apps and retry.';
  return error?.message||'Could not start the microphone. Try again or import an audio file.';
}

function ClipLane({ title, description, clip, onFile, onClear, onAnalyze, analyzing, kind, onKind, onExcerptChange, onDuration, index }) {
  const input = useRef(null);
  const playback = useRef(null);
  const longClip = clip?.fullDuration>60;
  const excerptStart = clip?.excerptStart??0;
  const excerptEnd = Math.min(clip?.fullDuration||0,excerptStart+LONG_CLIP_EXCERPT_SECONDS);
  const previewExcerpt = () => {
    const audio=playback.current;
    if(!audio)return;
    audio.pause();
    if(audio.readyState>=1)audio.currentTime=excerptStart;
    else audio.addEventListener('loadedmetadata',()=>{audio.currentTime=excerptStart;},{once:true});
    audio.dataset.excerptPreview='yes';
    void audio.play().catch(()=>{audio.dataset.excerptPreview='no';});
  };
  return <section className={'lane '+(title==='Your take'?'lane-take':'lane-reference')} aria-label={title + ' audio'}>
    <div className="lane-heading"><div><p className="eyebrow">{title}</p><p className="hint">{description}</p></div><span className="lane-index">{clip?.analysis?'ANALYZED':clip?'LOADED':index}</span></div>
    <label className="source-choice">Source type
      <select aria-label={title + ' source type'} value={kind} onChange={e=>onKind(e.target.value)}>
        <option value="solo_bass">Solo bass</option><option value="humming">Humming</option>
        <option value="separated_stem">Separated stem</option><option value="mixed_reference">Mixed music (pitch may be unreliable)</option>
      </select>
    </label>
    {clip ? <div className="clip"><div><strong>{clip.name}</strong><small>{(clip.file.size / 1048576).toFixed(2)} MB · {clip.file.type || 'unknown media type'}</small></div>
      <div className="clip-actions"><a className="text-button" href={clip.url} download={clip.name}>Download original</a><button className="text-button" onClick={onClear} type="button">Remove</button></div></div>
      : <button className="upload" onClick={() => input.current?.click()} type="button">{title==='Reference'?'+ Add reference recording':'+ Import your own recording'}</button>}
    <input ref={input} className="sr-only" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.webm,.ogg" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value=''; }} />
    {longClip && <div className="source-excerpt" aria-label={title + ' analysis excerpt'}>
      <div className="source-excerpt-heading"><strong>ANALYSIS EXCERPT · {excerptStart.toFixed(1)}–{excerptEnd.toFixed(1)}s</strong>
        <span>{clip.fullDuration.toFixed(1)}s full recording · original preserved</span></div>
      <p className="hint">{clip.analysis ? 'Move the window to explore another part of your original recording, then analyze again.' : 'Choose where to listen, or leave this at the start for automatic active-section detection. Your original is untouched.'}</p>
      <div className="source-excerpt-actions">
        <input type="range" aria-label={title + ' analysis excerpt position'} min="0"
          max={Math.max(0,clip.fullDuration-LONG_CLIP_EXCERPT_SECONDS)} step=".1"
          value={excerptStart} disabled={analyzing} onChange={e=>onExcerptChange(Number(e.target.value))}/>
        <button className="button-quiet" type="button" onClick={previewExcerpt}>▶ Preview selection</button>
      </div>
    </div>}
    {clip && <div className="lane-actions"><audio ref={playback} controls preload="metadata" src={clip.url} aria-label={title + ' original audio'}
      onLoadedMetadata={e=>onDuration(clip.file,e.currentTarget.duration)}
      onTimeUpdate={e=>{if(longClip&&e.currentTarget.dataset.excerptPreview==='yes'&&e.currentTarget.currentTime>=excerptEnd&&e.currentTarget.currentTime>excerptStart+.2){e.currentTarget.pause();e.currentTarget.dataset.excerptPreview='no';}}} />
      <button className="button-quiet" onClick={onAnalyze} disabled={analyzing}>{analyzing ? 'Listening…' : clip.analysis ? 'Analyze again' : 'Analyze shape'}</button></div>}
    {clip?.analysis && <Contour analysis={clip.analysis} label={title}/>}
  </section>;
}

function Library({ entries, onOpen, onDelete, onDeleteAll, onExport, onImport, transferBusy, isSaving, onSave, canSave, title, onTitle }) {
  const backupInput=useRef(null);
  return <section className="library" id="keep" aria-label="Your locally saved phrases">
    <div className="compare-head"><div><p className="eyebrow">05 / PRESERVE</p><h2>Keep the accident.</h2></div><span className="hint">Private browser library</span></div>
    <p className="library-intro">Your ideas stay in this browser. Export a project backup to keep its audio and musical shapes together—or bring one back on another device.</p>
    <div className="save-row">
      <label>Phrase name<input value={title} onChange={e=>onTitle(e.target.value)} maxLength={90} placeholder="That riff with the long pause" /></label>
      <button className="button-record" disabled={!canSave || isSaving} onClick={onSave}>{isSaving ? 'Saving…' : 'Keep this phrase'}</button>
    </div>
    {entries.length ? <div className="saved-list">{entries.map(entry=><article key={entry.id} className="saved-item">
      <div><strong>{entry.title}</strong><small>{new Date(entry.createdAt).toLocaleDateString()} · Original recordings preserved</small></div>
      <div className="saved-actions">
        <button className="button-quiet" onClick={()=>onOpen(entry)}>Open</button>
        <button className="button-quiet" onClick={()=>onExport(entry)} disabled={transferBusy}>Export project</button>
        <button className="text-button" onClick={()=>onDelete(entry.id)}>Delete</button>
      </div>
    </article>)}</div> : <p className="caption">Your saved musical discoveries will appear here.</p>}
    <div className="backup-tools">
      <div><strong>Bring an idea with you.</strong><p>Import a previous OFFBEAT project file. Nothing uploads to a server.</p></div>
      <button type="button" className="button-quiet" disabled={transferBusy} onClick={()=>backupInput.current?.click()}>
        {transferBusy?'Working locally…':'Import project backup'}
      </button>
      <input className="sr-only" ref={backupInput} type="file" accept=".json,.offbeat.json,application/json"
        aria-label="OFFBEAT project backup file" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onImport(file);}}/>
    </div>
    {!!entries.length && <button className="text-button library-delete-all" onClick={onDeleteAll}>Delete all local sessions</button>}
  </section>;
}

export default function App() {
  const [loops,setLoops]=useState({});
  const [reference,setReference]=useState(null);
  const [take,setTake]=useState(null);
  const [refKind,setRefKind]=useState('separated_stem');
  const [takeKind,setTakeKind]=useState('humming');
  const [recording,setRecording]=useState(false);
  const [recordSeconds,setRecordSeconds]=useState(0);
  const [requestingMic,setRequestingMic]=useState(false);
  const [busy,setBusy]=useState({});
  const [comparing,setComparing]=useState(false);
  const [comparison,setComparison]=useState(null);
  const [normalized,setNormalized]=useState(false);
  const [selection,setSelection]=useState({start:0,end:4});
  const [refWindowStart,setRefWindowStart]=useState(0);
  const [entries,setEntries]=useState([]);
  const [title,setTitle]=useState('');
  const [saving,setSaving]=useState(false);
  const [transferBusy,setTransferBusy]=useState(false);
  const [activeSessionId,setActiveSessionId]=useState(null);
  const [groovePattern,setGroovePattern]=useState(null);
  const [message,setMessage]=useState('');
  const recorder=useRef(null);
  const recordingStarted=useRef(0);
  const micRequestPending=useRef(false);
  const mounted=useRef(false);
  const referenceRef=useRef(null);
  const takeRef=useRef(null);
  const jobs=useRef(new Map());
  const compareJob=useRef(null);

  const invalidate=()=>{compareJob.current?.abort();compareJob.current=null;setComparison(null);setNormalized(false);setComparing(false);};
  const refreshLibrary=()=>listSessions().then(result=>{if(mounted.current)setEntries(result);}).catch(error=>{if(mounted.current)setMessage(error.message);});
  useEffect(()=>{
    if(!recording)return undefined;
    const interval=setInterval(()=>setRecordSeconds(Math.floor((Date.now()-recordingStarted.current)/1000)),400);
    return ()=>clearInterval(interval);
  },[recording]);
  useEffect(()=>{
    mounted.current=true;
    refreshLibrary();
    return ()=>{
      mounted.current=false;
      stopAll();
      recorder.current?.cancel();
      jobs.current.forEach(c=>c.abort());
      compareJob.current?.abort();
      if(referenceRef.current)URL.revokeObjectURL(referenceRef.current.url);
      if(takeRef.current)URL.revokeObjectURL(takeRef.current.url);
    };
  },[]);

  const replaceClip=(lane,clip)=>{
    setActiveSessionId(null);
    if(lane==='take')setGroovePattern(null);
    const setter=lane==='reference'?setReference:setTake;
    const handle=lane==='reference'?referenceRef:takeRef;
    if(handle.current)URL.revokeObjectURL(handle.current.url);
    handle.current=clip;
    setter(clip);
    jobs.current.get(lane)?.abort();
    jobs.current.delete(lane);
    setBusy(prev=>({...prev,[lane]:false}));
    invalidate();
  };
  const setFile=(lane,file)=>{
    if(!file.size||file.size>MAX_BYTES||!(file.type.startsWith('audio/')||allowedExtensions.test(file.name))){
      setMessage('Choose a supported audio file under 25 MB.');return;
    }
    replaceClip(lane,{file,name:file.name,url:URL.createObjectURL(file),analysis:null,excerptStart:null,fullDuration:null});
    setRefWindowStart(0);
    if(lane==='reference')setSelection({start:0,end:4});
    setMessage('');
  };

  // Browsers know the full duration from the native audio player before DSP
  // starts. Show the selection slider even if Safari cannot run its worker.
  const setClipDuration=(lane,file,duration)=>{
    if(!Number.isFinite(duration)||duration<=0||duration>3600)return;
    const handle=lane==='reference'?referenceRef:takeRef;
    const setter=lane==='reference'?setReference:setTake;
    if(handle.current?.file!==file)return;
    if(Math.abs((handle.current.fullDuration||0)-duration)<.05)return;
    const updated={...handle.current,fullDuration:duration};
    handle.current=updated;
    setter(updated);
  };

  const analyze=async(lane,clip,sourceKind)=>{
    if(!clip)return;
    const controller=new AbortController();
    jobs.current.get(lane)?.abort();jobs.current.set(lane,controller);
    invalidate();
    setBusy(prev=>({...prev,[lane]:true}));setMessage('');
    try{
      const {analysis:result,excerptStart,fullDuration}=await analyzeClip(clip.file,sourceKind,controller.signal,clip.excerptStart);
      if(jobs.current.get(lane)!==controller)return;
      const handle=lane==='reference'?referenceRef:takeRef;
      const setter=lane==='reference'?setReference:setTake;
      if(handle.current?.file!==clip.file)return;
      const next={...handle.current,analysis:result,excerptStart,fullDuration};
      handle.current=next;setter(next);
      if(lane==='reference')setSelection({start:0,end:result.source.duration_s});
      else if(!referenceRef.current?.analysis)setSelection({start:0,end:result.source.duration_s});
      setRefWindowStart(0);
      if(fullDuration>60)setMessage('Analyzed '+LONG_CLIP_EXCERPT_SECONDS+' seconds from your '+fullDuration.toFixed(1)+'-second original. Move the excerpt slider to explore another section.');
      return true;
    }catch(e){if(!controller.signal.aborted&&mounted.current)setMessage(e.message);return false;}
    finally{
      if(jobs.current.get(lane)===controller){jobs.current.delete(lane);setBusy(prev=>({...prev,[lane]:false}));}
    }
  };

  const compare=async()=>{
    if(!reference?.analysis||!take?.analysis)return;
    compareJob.current?.abort();
    const controller=new AbortController();
    compareJob.current=controller;setComparing(true);setMessage('');
    try{
      const referenceDuration=reference.analysis.source.duration_s;
      const takeDuration=take.analysis.source.duration_s;
      const excerptLength=Math.min(referenceDuration,takeDuration);
      const excerptStart=Math.max(0,Math.min(refWindowStart,referenceDuration-excerptLength));
      const referenceRegion={
        start_s:Number(excerptStart.toFixed(3)),
        end_s:Number(Math.min(referenceDuration,excerptStart+excerptLength).toFixed(3)),
      };
      const data=await compareClips(reference.analysis,take.analysis,referenceRegion,controller.signal);
      if(data.schema_version!=='offbeat.compare.v1')throw new Error('Comparison version mismatch.');
      if(compareJob.current!==controller)return;
      setComparison(data);setNormalized(true);
      const a=data.alignment;
      setSelection(selectableRange(a.reference_anchor_start_s,a.reference_anchor_end_s,reference.analysis.source.duration_s));
    }catch(e){if(!controller.signal.aborted&&mounted.current)setMessage('Comparison unavailable: '+e.message);}
    finally{if(compareJob.current===controller){compareJob.current=null;setComparing(false);}}
  };

  const chooseExcerptStart=(lane,value)=>{
    const handle=lane==='reference'?referenceRef:takeRef;
    const setter=lane==='reference'?setReference:setTake;
    const current=handle.current;
    if(!current?.fullDuration||current.fullDuration<=60)return;
    const start=Math.max(0,Math.min(Number(value)||0,current.fullDuration-LONG_CLIP_EXCERPT_SECONDS));
    if(Math.abs((current.excerptStart??0)-start)<.001)return;
    jobs.current.get(lane)?.abort();jobs.current.delete(lane);
    const next={...current,excerptStart:start,analysis:null};
    handle.current=next;setter(next);invalidate();setActiveSessionId(null);
    if(lane==='take')setGroovePattern(null);
    setMessage('Selection changed. Tap Analyze shape to hear this section.');
  };

  const chooseSourceKind=(lane,kind)=>{
    const setter=lane==='reference'?setReference:setTake;
    const handle=lane==='reference'?referenceRef:takeRef;
    if(lane==='reference')setRefKind(kind);
    else setTakeKind(kind);
    if(handle.current?.analysis && handle.current.analysis.source.kind!==kind){
      const updated={...handle.current,analysis:null};
      handle.current=updated;setter(updated);invalidate();
      setMessage('Source type updated. Choose Analyze shape to refresh the recording analysis.');
    }
  };
  const startRecording=async()=>{
    if(micRequestPending.current||recorder.current)return;
    micRequestPending.current=true;setRequestingMic(true);
    try{
      const active=await createMicrophoneRecorder();
      if(!mounted.current){active.cancel();return;}
      recorder.current=active;recordingStarted.current=Date.now();setRecordSeconds(0);setRecording(true);setMessage('Recording locally. Press Stop when done.');
    }catch(e){if(mounted.current)setMessage(microphoneFailure(e));}
    finally{micRequestPending.current=false;if(mounted.current)setRequestingMic(false);}
  };
  const stopRecording=async()=>{
    const active=recorder.current;
    if(!active)return;
    recorder.current=null;setRecording(false);
    try{
      const blob=await active.stop();
      if(!mounted.current)return;
      const ext=blob.type.includes('wav')?'wav':blob.type.includes('mp4')?'m4a':blob.type.includes('webm')?'webm':blob.type.includes('ogg')?'ogg':'audio';
      const file=new File([blob],`offbeat-take-${Date.now()}.${ext}`,{type:blob.type});
      setFile('take',file);
      const analyzed=await analyze('take',{file},takeKind);
      if(analyzed&&mounted.current)setMessage('Your musical shape is ready. Add a reference to compare, or save this idea.');
    }catch(e){if(mounted.current)setMessage(e.message);}
  };

  // The analyzer accepts at most 60 seconds; automatically finish capture.
  useEffect(()=>{
    if(recording && recordSeconds>=60 && recorder.current) void stopRecording();
  },[recording,recordSeconds]);

  const toggleLoop=async s=>{
    if(loops[s.id]){stopLoop(s.id);setLoops(prev=>({...prev,[s.id]:false}));return;}
    try{await playLoop(s.id,s.url);if(mounted.current)setLoops(prev=>({...prev,[s.id]:true}));}
    catch(e){setMessage(e.message);}
  };
  const keep=async()=>{
    setSaving(true);setMessage('');
    try{
      const saved=await saveSession({title,reference:referenceRef.current,take:takeRef.current,selection,comparison,groove:groovePattern});
      setActiveSessionId(saved.id);
      await refreshLibrary();setTitle('');
      setMessage('Saved locally. Your original audio stays unchanged.');
    }catch(e){setMessage('Could not save locally: '+e.message);}
    finally{setSaving(false);}
  };
  const exportEntry=async entry=>{
    if(transferBusy)return;
    setTransferBusy(true);setMessage('');
    try{
      const filename=await downloadSessionBackup(entry);
      if(mounted.current)setMessage('Project backup prepared: '+filename+'. Your original recordings were not changed.');
    }catch(error){if(mounted.current)setMessage('Could not export project: '+error.message);}
    finally{if(mounted.current)setTransferBusy(false);}
  };
  const importEntry=async file=>{
    if(transferBusy)return;
    setTransferBusy(true);setMessage('');
    try{
      const recovered=await parseSessionBackup(file);
      const saved=await saveSession(recovered);
      await refreshLibrary();
      if(mounted.current)setMessage('Imported "'+saved.title+'" into this browser. Original audio integrity verified.');
    }catch(error){if(mounted.current)setMessage('Could not import project: '+error.message);}
    finally{if(mounted.current)setTransferBusy(false);}
  };
  const openEntry=entry=>{
    jobs.current.forEach(c=>c.abort());jobs.current.clear();
    const r=restoreClip(entry.reference),t=restoreClip(entry.take);
    replaceClip('reference',r);
    replaceClip('take',t);
    setSelection(entry.selection);
    setRefWindowStart(entry.comparison?.alignment?.reference_region_start_s||0);
    if(r?.analysis?.source?.kind)setRefKind(r.analysis.source.kind);
    if(t?.analysis?.source?.kind)setTakeKind(t.analysis.source.kind);
    setActiveSessionId(entry.id);
    setGroovePattern(entry.groove||null);
    // Comparison is derived only from the exact saved analyses; clear stale
    // references from previous open before attaching the stored version.
    if(entry.comparison&&r?.analysis?.analysis_id===entry.comparison.reference_analysis_id
      &&t?.analysis?.analysis_id===entry.comparison.take_analysis_id){
      setComparison(entry.comparison);
    }
    setMessage('Opened saved originals and analysis. No network was needed.');
  };
  const deleteOne=async id=>{
    const target=entries.find(e=>e.id===id);
    if(!window.confirm(`Delete "${target?.title||'this phrase'}" from this browser? This cannot be undone.`))return;
    try{
      await removeSession(id);
      if(activeSessionId===id){replaceClip('reference',null);replaceClip('take',null);setSelection({start:0,end:4});}
      await refreshLibrary();setMessage('Local session deleted.');
    }
    catch(e){setMessage(e.message);}
  };
  const deleteAll=async()=>{
    if(!window.confirm('Permanently delete every Offbeat session saved in this browser?'))return;
    try{
      await clearSessions();
      if(activeSessionId){replaceClip('reference',null);replaceClip('take',null);setSelection({start:0,end:4});}
      await refreshLibrary();setMessage('All saved sessions deleted from this browser.');
    }
    catch(e){setMessage(e.message);}
  };

  const refDuration=reference?.analysis?.source.duration_s||take?.analysis?.source.duration_s||0;
  const selected=selectableRange(selection.start,selection.end,refDuration||4);
  const takeDuration=take?.analysis?.source.duration_s||0;
  const referenceExcerptSeconds=takeDuration?Math.min(refDuration,takeDuration):0;
  const maxReferenceWindowStart=Math.max(0,refDuration-referenceExcerptSeconds);
  const effectiveReferenceWindowStart=Math.min(refWindowStart,maxReferenceWindowStart);
  const canSave=!!reference?.analysis||!!take?.analysis;
  const currentStep=comparison?4:reference?.analysis&&take?.analysis?3:take?.analysis||reference?.analysis?2:1;
  const recordingClock=`${String(Math.floor(recordSeconds/60)).padStart(2,'0')}:${String(recordSeconds%60).padStart(2,'0')}`;
  return <main className="shell">
    <header className="topbar"><strong>OFFBEAT<span className="mark">◦</span></strong><span>AN INSTRUMENT FOR LISTENING TO YOURSELF</span><span>GROOVE / V0.2</span></header>
    <section className="hero"><p className="eyebrow">YOUR IDEAS, BEFORE THEY DISAPPEAR.</p><h1>Hear it in your head.<br/><em>Catch it here.</em></h1>
      <p>Hum a melody. Play a bass line. See its shape, hear it back, and keep the part you love. No wrong notes.</p></section>
    <nav className="journey" aria-label="Your Offbeat workflow">
      {[{name:'Capture',href:'#capture'},{name:'Shape',href:'#take'},{name:'Groove',href:'#groove'},{name:'Keep',href:'#keep'}].map((step,i)=>
        <a key={step.name} href={step.href} className={i+1===currentStep?'journey-current':i+1<currentStep?'journey-complete':''}
          aria-current={i+1===currentStep?'step':undefined}><span className="journey-index">{String(i+1).padStart(2,'0')}</span>{step.name}</a>)}
    </nav>
    <div className="workspace">
      <section className="capture-panel" id="capture" aria-label="Capture a musical idea">
        <div className="capture-header"><div><p className="eyebrow">01 / CAPTURE</p><h2>Start with a sound.</h2></div><span className="capture-pill">PRIVATE · ON DEVICE</span></div>
        <p className="capture-intro">No instrument needed. Pick what you're recording, then press once to begin.</p>
        <div className="capture-mode" role="group" aria-label="What are you recording?">
          <button type="button" aria-pressed={takeKind==='humming'} disabled={recording||requestingMic}
            onClick={()=>chooseSourceKind('take','humming')}>◌ Humming</button>
          <button type="button" aria-pressed={takeKind==='solo_bass'} disabled={recording||requestingMic}
            onClick={()=>chooseSourceKind('take','solo_bass')}>♫ Playing bass</button>
        </div>
        <div className="record-row">
          <button type="button" className={recording?'button-record active':'button-record'} disabled={requestingMic}
            onClick={recording?stopRecording:startRecording}>
            {requestingMic?'Waiting for microphone…':recording?'■ Stop recording':'● Record or hum'}
          </button>
          {recording?<span className="recording-clock" aria-live="off"><span className="recording-dot"/>REC {recordingClock}</span>
            :<span className="record-privacy">Microphone only turns on when you tap Record.</span>}
        </div>
        <p className="capture-footnote">Audio analysis happens {ANALYSIS_LOCATION}. Your recordings aren't uploaded.</p>
      </section>
      {message&&<p className="status" role="status">{message}</p>}
      <div id="take"><ClipLane title="Your take" description="Your captured idea. Listen and inspect the contour before comparing." clip={take}
        onFile={file=>setFile('take',file)} onClear={()=>replaceClip('take',null)}
        onAnalyze={()=>analyze('take',take,takeKind)} analyzing={busy.take}
        kind={takeKind} onKind={value=>chooseSourceKind('take',value)} onExcerptChange={value=>chooseExcerptStart('take',value)} onDuration={(file,duration)=>setClipDuration('take',file,duration)} index="02"/></div>
      {take?.analysis&&!reference?.analysis&&<aside className="capture-next">
        <div><strong>Your idea has a shape.</strong><p>Keep it as it is, or add a reference to hear what changed.</p></div>
        <div className="capture-next-actions"><a href="#keep">◇ Keep this idea</a><a href="#reference">+ Add reference</a></div>
      </aside>}
      <div id="reference"><ClipLane title="Reference" description="Optional: add a bass stem or another recording when you're ready to compare." clip={reference}
        onFile={file=>setFile('reference',file)} onClear={()=>replaceClip('reference',null)}
        onAnalyze={()=>analyze('reference',reference,refKind)} analyzing={busy.reference}
        kind={refKind} onKind={value=>chooseSourceKind('reference',value)} onExcerptChange={value=>chooseExcerptStart('reference',value)} onDuration={(file,duration)=>setClipDuration('reference',file,duration)} index="03"/></div>
    </div>

    <section className="compare-workspace" id="mirror">
      <div className="compare-head"><div><p className="eyebrow">03 / COMPARE</p><h2>Two sounds. One conversation.</h2></div>
        <button className="button-record" disabled={!reference?.analysis||!take?.analysis||comparing}
          onClick={compare}>{comparing?'Comparing…':'Compare these phrases'}</button></div>
      {(!reference?.analysis||!take?.analysis)&&<p className="compare-prompt">
        {take?.analysis?'Your shape is ready. Add and analyze a reference to compare it.':
          'Record or import your idea first, then add a reference when you want to compare.'}
      </p>}
      {reference?.analysis&&take?.analysis&&
        <ExcerptPicker clip={reference} start={effectiveReferenceWindowStart}
          length={referenceExcerptSeconds} maxStart={maxReferenceWindowStart}
          onError={setMessage} onChange={value=>{
            setRefWindowStart(value);invalidate();
          }}/>}
      <MirrorCompare reference={reference} take={take} comparison={comparison} normalized={normalized} onNormalize={setNormalized}/>
      {reference?.analysis&&take?.analysis&&<section className="selection" aria-label="Select phrase segment">
        <p className="eyebrow">SELECTION / NON-DESTRUCTIVE</p><p className="hint">Choose a region on the reference timeline. Offbeat maps it to the corresponding region of your take for A/B listening.</p>
        <div className="range-fields">
          <label>Start · {selected.start.toFixed(2)}s
            <input aria-label="Phrase start" type="range" min="0" max={Math.max(.2,refDuration-.12)} step=".01" value={selected.start}
              onChange={e=>setSelection(prev=>selectableRange(Number(e.target.value),prev.end,refDuration))}/></label>
          <label>End · {selected.end.toFixed(2)}s
            <input aria-label="Phrase end" type="range" min=".12" max={Math.max(.2,refDuration)} step=".01" value={selected.end}
              onChange={e=>setSelection(prev=>selectableRange(prev.start,Number(e.target.value),refDuration))}/></label>
        </div>
        <p className="caption">The original recordings are never trimmed or overwritten. Slider keys: arrows for fine adjustment.</p>
      </section>}
      <PhrasePlayer reference={reference} take={take} comparison={comparison} selection={selected}/>
    </section>
    <GrooveLab key={(take?.analysis?.analysis_id||'none')+':'+(activeSessionId||'new')}
      take={take} reference={reference} selection={selected} comparison={comparison}
      initialGroove={groovePattern} onPatternChange={setGroovePattern}
      onStopDemo={()=>{stopAll();setLoops({});}}/>
    <Library entries={entries} title={title} onTitle={setTitle} isSaving={saving} onSave={keep} canSave={canSave}
      onOpen={openEntry} onDelete={deleteOne} onDeleteAll={deleteAll}
      onExport={exportEntry} onImport={importEntry} transferBusy={transferBusy}/>
    <details className="playground">
      <summary><span>OPTIONAL / LISTENING PLAYGROUND</span><strong>Explore the sample loops</strong><span aria-hidden="true">＋</span></summary>
      <div className="samples"><p className="hint">Try the drum, bass and melody layers when you feel like experimenting.</p>
        <div className="sample-list">{samples.map(s=><button key={s.id} onClick={()=>toggleLoop(s)} className={loops[s.id]?'sample on':'sample'} aria-pressed={!!loops[s.id]}><span>{s.name}</span><span>{loops[s.id]?'■ Stop':'▶ Play'}</span></button>)}</div></div>
    </details>
    <nav className="mobile-nav" aria-label="Offbeat mobile navigation">
      <a href="#capture"><span aria-hidden="true">◌</span>Capture</a>
      <a href="#groove"><span aria-hidden="true">♫</span>Groove</a>
      <a href="#keep"><span aria-hidden="true">◇</span>Keep</a>
    </nav><footer>OFFBEAT · Local first · Only keep the parts you love.</footer>
  </main>;
}
