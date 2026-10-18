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

function clipTitle(file, fallback) {
  if (!file) return fallback;
  const filename=file.name||'';
  if (/\b(pluck|fingerstyle|finger)[\s_.-]*/i.test(filename)) return 'Pluck';
  if (/\bpick(?:ed|ing)?\b/i.test(filename)) return 'Pick';
  if (/\bhum(?:ming)?\b/i.test(filename)) return 'Hum';
  return fallback;
}
function inferSourceKind(name) {
  if (/\b(stem|separated)[\s_.-]*/i.test(name)) return 'separated_stem';
  if (/\b(bass|pluck|fingerstyle|pick)\b/i.test(name)) return 'solo_bass';
  if (/\b(hum|humming|vocal|voice)\b/i.test(name)) return 'humming';
  return null;
}

function ClipLane({ title, description, clip, onFile, onClear, onAnalyze, analyzing, kind, onKind, onExcerptChange, onDuration, index }) {
  const input=useRef(null),playback=useRef(null);
  const longClip=clip?.fullDuration>60;
  const excerptStart=clip?.excerptStart??0;
  const excerptEnd=Math.min(clip?.fullDuration||0,excerptStart+LONG_CLIP_EXCERPT_SECONDS);
  const previewExcerpt=()=>{
    const audio=playback.current;
    if(!audio)return;
    audio.pause();
    if(audio.readyState>=1)audio.currentTime=excerptStart;
    else audio.addEventListener('loadedmetadata',()=>{audio.currentTime=excerptStart;},{once:true});
    audio.dataset.excerptPreview='yes';
    void audio.play().catch(()=>{audio.dataset.excerptPreview='no';});
  };
  const name=clipTitle(clip?.file,title);
  return <section className={'lane '+(title==='Your take'?'lane-take':'lane-reference')} aria-label={title+' audio'}>
    <div className="lane-heading">
      <div className="lane-label">
        <span className="lane-letter">{index}</span>
        <div><h3>{name}</h3><p className="lane-filename">{clip?.name||description}</p></div>
      </div>
      <span className="lane-index">{analyzing?'LISTENING…':clip?.analysis?'READY':clip?'LOADED':'EMPTY'}</span>
    </div>
    <input ref={input} className="sr-only" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.webm,.ogg"
      onChange={e=>{if(e.target.files?.[0])onFile(e.target.files[0]);e.target.value='';}}/>
    {clip ? <>
      <div className="clip-main-actions">
        <button type="button" className="text-button" onClick={()=>input.current?.click()}>Replace</button>
        <button type="button" className="text-button" onClick={onClear}>Remove</button>
      </div>
      <audio ref={playback} controls preload="metadata" src={clip.url} aria-label={title+' original audio'}
        onLoadedMetadata={e=>onDuration(clip.file,e.currentTarget.duration)}
        onTimeUpdate={e=>{
          if(longClip&&e.currentTarget.dataset.excerptPreview==='yes'&&e.currentTarget.currentTime>=excerptEnd&&e.currentTarget.currentTime>excerptStart+.2){
            e.currentTarget.pause();e.currentTarget.dataset.excerptPreview='no';
          }
        }}/>
      {analyzing?<p className="clip-feedback" role="status">Finding the shape of this recording…</p>:
        !clip.analysis?<button className="button-quiet clip-analyze" onClick={onAnalyze}>Analyze shape</button>:
        <div className="clip-feedback clip-done"><span aria-hidden="true">✓</span> Shape ready</div>}
      {longClip&&<details className="clip-details" key="excerpt">
        <summary>Choose excerpt <span>{excerptStart.toFixed(0)}–{excerptEnd.toFixed(0)}s of {Math.round(clip.fullDuration)}s</span></summary>
        <div className="clip-details-body">
          <input type="range" aria-label={title+' analysis excerpt position'}
            min="0" max={Math.max(0,clip.fullDuration-LONG_CLIP_EXCERPT_SECONDS)} step=".1"
            value={excerptStart} disabled={analyzing} onChange={e=>onExcerptChange(Number(e.target.value))}/>
          <button className="button-quiet" type="button" onClick={previewExcerpt}>▶ Preview excerpt</button>
          <p className="caption">Changing this section requires a fresh analysis. Your original stays intact.</p>
        </div>
      </details>}
      <details className="clip-details" key="options">
        <summary>More about this recording</summary>
        <div className="clip-details-body">
          <label className="source-choice">Recording type
            <select aria-label={title+' source type'} value={kind} onChange={e=>onKind(e.target.value)}>
              <option value="solo_bass">Solo bass</option><option value="humming">Humming</option>
              <option value="separated_stem">Separated stem</option><option value="mixed_reference">Mixed music</option>
            </select>
          </label>
          {clip.analysis&&<Contour analysis={clip.analysis} label={title}/>}
          <a className="text-button" href={clip.url} download={clip.name}>Download original</a>
        </div>
      </details>
    </>:
      <button className="upload" onClick={()=>input.current?.click()} type="button">+ {index==='A'?'Add your first sound':'Add another sound'}</button>}
  </section>;
}

function Library({ entries, onOpen, onDelete, onDeleteAll, onExport, onImport, transferBusy, isSaving, onSave, canSave, title, onTitle }) {
  const backupInput=useRef(null);
  return <section className="library" id="keep" aria-label="Your locally saved phrases">
    <div className="compact-section-head"><h2>Keep the good part.</h2><span>On this device</span></div>
    <div className="save-row">
      <label className="sr-only" htmlFor="phrase-name">Name your phrase</label>
      <input id="phrase-name" aria-label="Phrase name" value={title} onChange={e=>onTitle(e.target.value)}
        maxLength={90} placeholder="Name this idea…"/>
      <button className="button-record" disabled={!canSave||isSaving} onClick={onSave}>{isSaving?'Saving…':'Keep this phrase'}</button>
    </div>
    <details className="quiet-drawer saved-drawer">
      <summary>My saved ideas <span>{entries.length} saved</span></summary>
      <div className="drawer-body">
        {entries.length?<div className="saved-list">{entries.map(entry=><article key={entry.id} className="saved-item">
          <div><strong>{entry.title}</strong><small>{new Date(entry.createdAt).toLocaleDateString()}</small></div>
          <div className="saved-actions">
            <button className="button-quiet" onClick={()=>onOpen(entry)}>Open</button>
            <button className="button-quiet" onClick={()=>onExport(entry)} disabled={transferBusy}>Export project</button>
            <button className="text-button" onClick={()=>onDelete(entry.id)}>Delete</button>
          </div>
        </article>)}</div>:<p className="caption">Ideas you save will live here.</p>}
        <div className="backup-tools">
          <p>Restore a previously exported OFFBEAT project.</p>
          <button type="button" className="button-quiet" disabled={transferBusy} onClick={()=>backupInput.current?.click()}>
            {transferBusy?'Working locally…':'Import project backup'}
          </button>
          <input className="sr-only" ref={backupInput} type="file" accept=".json,.offbeat.json,application/json"
            aria-label="OFFBEAT project backup file" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onImport(file);}}/>
        </div>
        {!!entries.length&&<button className="text-button library-delete-all" onClick={onDeleteAll}>Delete all local sessions</button>}
      </div>
    </details>
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
  const analysisQueue=useRef(Promise.resolve());
  const autoComparePair=useRef(null);

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
    const clip={file,name:file.name,url:URL.createObjectURL(file),analysis:null,excerptStart:null,fullDuration:null};
    replaceClip(lane,clip);
    const inferred=inferSourceKind(file.name);
    if(inferred){if(lane==='take')setTakeKind(inferred);else setRefKind(inferred);}
    // One on-device analysis at a time: two long imports must not overload iOS.
    setBusy(prev=>({...prev,[lane]:true}));
    analysisQueue.current=analysisQueue.current.catch(()=>{}).then(async()=>{
      const current=lane==='take'?takeRef.current:referenceRef.current;
      if(current?.file!==file)return;
      await analyze(lane,current,inferred||(lane==='take'?takeKind:refKind));
    });
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
      if(fullDuration>60)setMessage('Analyzed '+LONG_CLIP_EXCERPT_SECONDS+' seconds of '+Math.round(fullDuration)+'s. Change section under the clip if needed.');
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
  useEffect(()=>{
    const id=take?.analysis?.analysis_id&&reference?.analysis?.analysis_id
      ?take.analysis.analysis_id+':'+reference.analysis.analysis_id:null;
    if(!id||id===autoComparePair.current)return;
    autoComparePair.current=id;
    if(comparison?.take_analysis_id===take.analysis.analysis_id&&
       comparison?.reference_analysis_id===reference.analysis.analysis_id)return;
    void compare();
  },[take?.analysis?.analysis_id,reference?.analysis?.analysis_id]);

  const recordingClock=`${String(Math.floor(recordSeconds/60)).padStart(2,'0')}:${String(recordSeconds%60).padStart(2,'0')}`;
  const readyToCompare=!!take?.analysis&&!!reference?.analysis;
  const takeLabel=clipTitle(take?.file,'Sound A');
  const referenceLabel=clipTitle(reference?.file,'Sound B');
  return <main className="shell quiet-shell">
    <header className="topbar"><strong>OFFBEAT<span className="mark">◦</span></strong><span>AN INSTRUMENT FOR YOUR IDEAS</span><nav aria-label="OFFBEAT instruments" style={{display:"flex",alignItems:"center",gap:"7px"}}><a href="/instrument/" aria-label="Play FORM touch instrument" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#21150e",textDecoration:"none",border:"1px solid #d5a07d",background:"#d5a07d",borderRadius:"4px",padding:"0 11px",minHeight:"44px",fontSize:"11px",fontWeight:750,whiteSpace:"nowrap"}}>◉ PLAY FORM</a><a href="/bass-mirror/" aria-label="Open Bass Mirror studio" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#f1c1a2",textDecoration:"none",border:"1px solid #855c49",background:"#2a211c",borderRadius:"4px",padding:"0 9px",minHeight:"44px",fontSize:"10px",fontWeight:700,whiteSpace:"nowrap"}}>MIRROR ↗</a></nav></header>
    <section className="hero">
      <p className="eyebrow">SOUND / PLAY / DISCOVER</p>
      <h1>{take&&reference?'Hear what changed.':'Catch what you hear.'}</h1>
      <p>{take&&reference?'Two takes, side by side. Find what feels different.':'Bring in a recording, or hum something new.'}</p>
    </section>
    <div className="workspace" id="capture">
      <details className="record-tray" open={!take}>
        <summary><span>◉ Record a new idea</span><span aria-hidden="true">＋</span></summary>
        <section className="capture-panel" aria-label="Capture a musical idea">
          <div className="capture-mode" role="group" aria-label="What are you recording?">
            <button type="button" aria-pressed={takeKind==='humming'} disabled={recording||requestingMic}
              onClick={()=>chooseSourceKind('take','humming')}>◌ Humming</button>
            <button type="button" aria-pressed={takeKind==='solo_bass'} disabled={recording||requestingMic}
              onClick={()=>chooseSourceKind('take','solo_bass')}>♫ Bass</button>
          </div>
          <div className="record-row">
            <button type="button" className={recording?'button-record active':'button-record'} disabled={requestingMic}
              onClick={recording?stopRecording:startRecording}>
              {requestingMic?'Connecting mic…':recording?'■ Stop recording':'● Record or hum'}
            </button>
            {recording?<span className="recording-clock" aria-live="off"><span className="recording-dot"/>REC {recordingClock}</span>:null}
          </div>
          <p className="caption">Your recordings stay on this device.</p>
        </section>
      </details>
      {message&&<p className="status" role="status">{message}</p>}
      <div id="take"><ClipLane title="Your take" description="First sound" clip={take}
        onFile={file=>setFile('take',file)} onClear={()=>replaceClip('take',null)}
        onAnalyze={()=>analyze('take',take,takeKind)} analyzing={busy.take}
        kind={takeKind} onKind={value=>chooseSourceKind('take',value)} onExcerptChange={value=>chooseExcerptStart('take',value)}
        onDuration={(file,duration)=>setClipDuration('take',file,duration)} index="A"/></div>
      <div id="reference"><ClipLane title="Reference" description="Second sound · optional" clip={reference}
        onFile={file=>setFile('reference',file)} onClear={()=>replaceClip('reference',null)}
        onAnalyze={()=>analyze('reference',reference,refKind)} analyzing={busy.reference}
        kind={refKind} onKind={value=>chooseSourceKind('reference',value)} onExcerptChange={value=>chooseExcerptStart('reference',value)}
        onDuration={(file,duration)=>setClipDuration('reference',file,duration)} index="B"/></div>
    </div>
    <section className="compare-workspace" id="mirror">
      <div className="compact-section-head"><h2>Listen side by side.</h2><span>{readyToCompare?'A / B ready':'Add two sounds'}</span></div>
      {readyToCompare?<>
        <PhrasePlayer reference={reference} take={take} comparison={comparison} selection={selected}
          takeLabel={takeLabel} referenceLabel={referenceLabel}/>
        {comparison&&<p className="quick-insight">{comparison.matched_onsets.length} nearby rhythmic attacks. <span>Timing only, not a score.</span></p>}
        <details className="quiet-drawer compare-drawer">
          <summary>See shapes & timing <span>Explore the details</span></summary>
          <div className="drawer-body">
            <MirrorCompare reference={reference} take={take} comparison={comparison} normalized={normalized} onNormalize={setNormalized}/>
            <button className="button-quiet" disabled={comparing} onClick={compare}>{comparing?'Comparing…':'Compare these phrases'}</button>
            <ExcerptPicker clip={reference} start={effectiveReferenceWindowStart} length={referenceExcerptSeconds}
              maxStart={maxReferenceWindowStart} onError={setMessage} onChange={value=>{setRefWindowStart(value);invalidate();}}/>
            <section className="selection" aria-label="Select phrase segment">
              <h3>Choose a shorter moment</h3>
              <div className="range-fields">
                <label>Start · {selected.start.toFixed(2)}s
                  <input aria-label="Phrase start" type="range" min="0" max={Math.max(.2,refDuration-.12)} step=".01" value={selected.start}
                    onChange={e=>setSelection(prev=>selectableRange(Number(e.target.value),prev.end,refDuration))}/></label>
                <label>End · {selected.end.toFixed(2)}s
                  <input aria-label="Phrase end" type="range" min=".12" max={Math.max(.2,refDuration)} step=".01" value={selected.end}
                    onChange={e=>setSelection(prev=>selectableRange(prev.start,Number(e.target.value),refDuration))}/></label>
              </div>
            </section>
          </div>
        </details>
      </>:<p className="compare-prompt">{take||reference?'Analyze both recordings to unlock A/B listening.':'Start with a recording above.'}</p>}
    </section>
    <details className="quiet-drawer feature-drawer" id="groove">
      <summary>Make a beat from this riff <span>Follow · Answer · Contrast</span></summary>
      <GrooveLab key={(take?.analysis?.analysis_id||'none')+':'+(activeSessionId||'new')}
        take={take} reference={reference} selection={selected} comparison={comparison}
        initialGroove={groovePattern} onPatternChange={setGroovePattern}
        onStopDemo={()=>{stopAll();setLoops({});}}/>
    </details>
    <Library entries={entries} title={title} onTitle={setTitle} isSaving={saving} onSave={keep} canSave={canSave}
      onOpen={openEntry} onDelete={deleteOne} onDeleteAll={deleteAll}
      onExport={exportEntry} onImport={importEntry} transferBusy={transferBusy}/>
    <details className="quiet-drawer playground">
      <summary>Sample loops <span>Optional playground</span></summary>
      <div className="samples"><div className="sample-list">{samples.map(s=><button key={s.id} onClick={()=>toggleLoop(s)}
        className={loops[s.id]?'sample on':'sample'} aria-pressed={!!loops[s.id]}><span>{s.name}</span><span>{loops[s.id]?'■ Stop':'▶ Play'}</span></button>)}</div></div>
    </details>
    <nav className="mobile-nav" aria-label="Offbeat mobile navigation">
      <a href="#capture"><span aria-hidden="true">◌</span>Sounds</a>
      <a href="#mirror"><span aria-hidden="true">♫</span>Compare</a>
      <a href="#keep"><span aria-hidden="true">◇</span>Save</a>
    </nav>
    <footer>OFFBEAT · Your audio stays yours.</footer>
  </main>;
}
