import React, {useEffect,useMemo,useRef,useState} from 'react';
import {generateGroove,validGroove} from '../lib/grooveEngine.mjs';
import {startGroove,stopGroove} from '../lib/grooveTransport.js';
import {exportGrooveWav,saveWav} from '../lib/grooveAudio.mjs';
import {selectableRange,selectionForLane} from '../lib/phraseRanges.mjs';

const choices=[
 {id:'follow',number:'01',name:'Follow',tag:'Your accents, amplified.',detail:'Kick follows your actual attacks. Little accents give the riff its pocket.'},
 {id:'answer',number:'02',name:'Answer',tag:'A conversation in the gaps.',detail:'Drums respond to the silence you left between phrases.'},
 {id:'contrast',number:'03',name:'Contrast',tag:'A different way through.',detail:'An offbeat counter-rhythm plays alongside your timing.'}
];
const colors={kick:'#daa17d',snare:'#bfd0bf',hat:'#aba0cc'};
function GrooveTimeline({pattern,analysis}){
 const length=pattern.range.end_s-pattern.range.start_s;
 const x=t=>30+t/length*600;
 const attacks=analysis.onsets.filter(o=>o.t_s>=pattern.range.start_s&&o.t_s<pattern.range.end_s);
 return <div className="groove-timeline" aria-label="Groove rhythm visualization">
  <div className="groove-legend"><span>Original attacks</span><span>Kick</span><span>Snare</span><span>Hat</span></div>
  <svg role="img" aria-label={pattern.events.length+' generated drum hits shown against '+attacks.length+' original attacks'} viewBox="0 0 660 146">
   {[18,51,83,115].map((y,i)=><React.Fragment key={i}>
    <line x1="28" y1={y} x2="635" y2={y} stroke="#4c4038" strokeWidth="1"/>
    <text x="0" y={y+4} fontSize="10" fill="#b9aca2">{i===0?'IN':i===1?'K':i===2?'S':'H'}</text>
   </React.Fragment>)}
   {analysis.rests.filter(r=>r.start_s<pattern.range.end_s&&r.end_s>pattern.range.start_s).map((r,i)=>{
    const a=Math.max(0,r.start_s-pattern.range.start_s),b=Math.min(length,r.end_s-pattern.range.start_s);
    return <rect key={i} x={x(a)} y="8" width={Math.max(0,x(b)-x(a))} height="118" fill="#9cae9e" opacity=".09"/>;
   })}
   {attacks.map((o,i)=><line key={i} x1={x(o.t_s-pattern.range.start_s)} x2={x(o.t_s-pattern.range.start_s)}
      y1="10" y2="26" stroke="#e2d9cf" opacity=".7" strokeWidth="2"/>)}
   {pattern.events.map((event,i)=>{
    const y=event.kind==='kick'?51:event.kind==='snare'?83:115;
    return <circle key={i} cx={x(event.time_s)} cy={y} r={3.2+event.velocity*4}
      fill={colors[event.kind]} opacity=".94"/>;
   })}
  </svg>
  <p className="caption">{pattern.events.length} generated hits · Original timing untouched · Shaded areas are detected rests</p>
 </div>;
}
export default function GrooveLab({take,reference,selection,comparison,initialGroove,onPatternChange,onStopDemo}){
 const analysis=take?.analysis;
 const restored=analysis&&validGroove(initialGroove,analysis)?initialGroove:null;
 const [mode,setMode]=useState(restored?.mode||'follow');
 const [density,setDensity]=useState(restored?.density??.65);
 const [strength,setStrength]=useState(restored?.strength??.65);
 const [swing,setSwing]=useState(restored?.swing??0);
 const [tempoMode,setTempoMode]=useState(restored?.tempo.mode||'free');
 const [bpm,setBpm]=useState(restored?.tempo.bpm||100);
 const [seed,setSeed]=useState(restored?.seed??7);
 const [playing,setPlaying]=useState(false);
 const [exporting,setExporting]=useState(false);
 const [notice,setNotice]=useState('');
 const [cycles,setCycles]=useState(0);
 const taps=useRef([]);
 const range=useMemo(()=>{
  if(!analysis)return null;
  const mapped=reference?.analysis&&comparison?
   selectionForLane(selection,comparison,'take',reference.analysis.source.duration_s,analysis.source.duration_s):
   selectableRange(selection.start,selection.end,analysis.source.duration_s);
  return {start:Math.max(0,mapped.start),end:Math.min(analysis.source.duration_s,mapped.end)};
 },[analysis,reference?.analysis,comparison,selection.start,selection.end]);
 const pattern=useMemo(()=>{
  if(!analysis||!range)return null;
  try{
   return generateGroove(analysis,{mode,start:range.start,end:Math.min(range.end,range.start+16),
    seed,density,strength,swing,tempoMode,bpm});
  }catch{return null;}
 },[analysis,range,mode,seed,density,strength,swing,tempoMode,bpm]);
 useEffect(()=>{
  stopGroove();setPlaying(false);setCycles(0);
  onPatternChange(pattern);
  // Deliberately stop old patterns whenever source, selection or mode changes.
 },[pattern,onPatternChange]);
 useEffect(()=>()=>stopGroove(),[]);
 const launch=async()=>{
  if(!pattern||!take?.url)return;
  if(playing){stopGroove();setPlaying(false);return;}
  setNotice('');
  try{
   onStopDemo?.();
   const did=await startGroove(take.url,pattern,()=>setCycles(c=>c+1),take.excerptStart||0);
   setPlaying(!!did);
  }catch(e){stopGroove();setPlaying(false);setNotice(e.message||'Playback failed on this browser.');}
 };
 const tap=()=>{
  const now=performance.now();
  taps.current=[...taps.current.filter(t=>now-t<2800),now].slice(-5);
  if(taps.current.length>1){
   const differences=taps.current.slice(1).map((t,i)=>t-taps.current[i]);
   const sorted=[...differences].sort((a,b)=>a-b);
   setBpm(Math.max(48,Math.min(200,Math.round(60000/sorted[Math.floor(sorted.length/2)]))));
  }
  setTempoMode('manual');
 };
 const exportMix=async()=>{
  if(!pattern||!take?.file)return;
  setExporting(true);setNotice('');
  try{
   const file=await exportGrooveWav(take.file,pattern,take.excerptStart||0);
   const name=saveWav(file,'offbeat-'+mode+'-'+seed);
   setNotice('Saved '+name+' · actual 16-bit PCM WAV with your original phrase and the generated drums.');
  }catch(e){setNotice(e.message||'Could not render the mixed WAV on this device.');}
  finally{setExporting(false);}
 };
 return <section className="groove-lab" id="groove" aria-label="Responsive drummer">
  <div className="groove-intro">
   <div><p className="eyebrow">04 / GROOVE · V0.2</p><h2>Your riff has a conversation waiting.</h2>
    <p>Give your accidental melody some drums. Follow what you played, answer your pauses, or find a counter-rhythm.</p></div>
   <span className="groove-local">ON DEVICE / NO GENERATIVE MODEL</span>
  </div>
  {!analysis?<p className="groove-empty">Record or import an idea and tap <strong>Analyze shape</strong> to wake up the drummer.</p>:<>
   <div className="groove-choices" role="group" aria-label="Groove response mode">
    {choices.map(item=><button type="button" key={item.id} aria-pressed={mode===item.id}
      className="groove-choice" onClick={()=>setMode(item.id)}>
      <small>{item.number} / {item.name.toUpperCase()}</small>
      <strong>{item.tag}</strong><span>{item.detail}</span>
    </button>)}
   </div>
   <div className="groove-controls">
    <label>Density <strong>{Math.round(density*100)}%</strong>
     <input type="range" aria-label="Drum density" min="0" max="1" step=".05" value={density} onChange={e=>setDensity(+e.target.value)}/></label>
    <label>Response <strong>{Math.round(strength*100)}%</strong>
     <input type="range" aria-label="Drum response strength" min="0" max="1" step=".05" value={strength} onChange={e=>setStrength(+e.target.value)}/></label>
    <label>Swing <strong>{Math.round(swing*100)}%</strong>
     <input type="range" aria-label="Drum swing" min="0" max=".5" step=".05" value={swing} disabled={mode!=='contrast'}
      onChange={e=>setSwing(+e.target.value)}/></label>
   </div>
   <div className="groove-tempo">
    <label className="toggle-row"><input type="checkbox" checked={tempoMode==='manual'}
      onChange={e=>setTempoMode(e.target.checked?'manual':'free')}/> Use manual drum tempo</label>
    <button type="button" className="button-quiet" onClick={tap}>Tap tempo</button>
    <label className="tempo-input">BPM <input aria-label="Drum tempo BPM" type="number" min="48" max="200" step="1" value={bpm}
      onChange={e=>{setBpm(Math.max(48,Math.min(200,Number(e.target.value)||100)));setTempoMode('manual');}}/></label>
    <span className="caption">{tempoMode==='free'?'Drum pulse follows detected spacing, without quantizing your take.':'Manual BPM applies to generated drums only.'}</span>
   </div>
   {pattern?<GrooveTimeline analysis={analysis} pattern={pattern}/>:<p className="warning">Choose a slightly longer, analyzed section to hear the drums.</p>}
   <div className="groove-actions">
    <button type="button" className="button-record" disabled={!pattern||exporting} onClick={launch} aria-pressed={playing}>
     {playing?'■ Stop groove':'▶ Play with drums'}</button>
    <button type="button" className="button-quiet" disabled={!pattern||exporting} onClick={()=>setSeed(x=>(x+1)%1000000)}>
     ↻ New variation</button>
    <button type="button" className="button-quiet" disabled={!pattern||exporting||playing} onClick={exportMix}>
     {exporting?'Rendering WAV…':'↓ Export mixed WAV'}</button>
   </div>
   <p className="groove-feedback" role="status">{notice||(pattern?
    choices.find(x=>x.id===mode)?.name+' · variation '+seed+' · '+pattern.events.length+' drum hits · '+cycles+' loops started.':
    'Analyze a short solo phrase first.')}</p>
   <p className="caption">Loop selection is limited to 16 seconds for responsive mobile playback/export. The original audio is untouched. Export is a locally rendered, 16-bit PCM WAV, not an MP3. Save the phrase below to keep its deterministic drum recipe in your project backup.</p>
  </>}
 </section>;
}
