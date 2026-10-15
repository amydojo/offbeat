// OFFBEAT GROOVE v0.2 — deterministic, on-device rhythmic responses.
// Source audio/onsets/rests are read-only. No grid/tempo modification is hidden.
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const round=x=>Number(x.toFixed(4));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const modes=new Set(['follow','answer','contrast']);
export const GROOVE_SCHEMA='offbeat.groove.v1';
export function validGroove(p,analysis){
 if(!p||p.schema_version!==GROOVE_SCHEMA||!modes.has(p.mode)||!analysis||
  p.source_analysis_id!==analysis.analysis_id||
  p.source_sha256!==analysis.source.sha256||
  !p.range||![p.range.start_s,p.range.end_s].every(finite)||
  p.range.start_s<0||p.range.end_s>analysis.source.duration_s+.01||
  p.range.end_s-p.range.start_s<.25||p.range.end_s-p.range.start_s>16.01||
  !Array.isArray(p.events)||p.events.length>256||
  !Number.isInteger(p.seed)||p.seed<0||p.seed>999999||
  !finite(p.density)||p.density<0||p.density>1||
  !finite(p.strength)||p.strength<0||p.strength>1||
  !finite(p.swing)||p.swing<0||p.swing>.5||
  !p.tempo||!['free','manual'].includes(p.tempo.mode)||
  !finite(p.tempo.bpm)||p.tempo.bpm<48||p.tempo.bpm>200)return false;
 const duration=p.range.end_s-p.range.start_s;
 return p.events.every(e=>e&&['kick','snare','hat'].includes(e.kind) &&
   finite(e.time_s)&&e.time_s>=0&&e.time_s<duration&&
   finite(e.velocity)&&e.velocity>=.05&&e.velocity<=1&&
   ['source_attack','source_rest','offbeat','pulse','intro'].includes(e.origin));
}
function seeded(seed){
 let x=(seed>>>0)||1;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
function median(numbers){
 if(!numbers.length)return null;
 const a=[...numbers].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];
}
function pulseFrom(onsets,bpm){
 const gaps=onsets.slice(1).map((x,i)=>x.t_s-onsets[i].t_s).filter(x=>x>=.18&&x<=1.5);
 const center=median(gaps);
 return center ? clamp(center,.28,.95):60/bpm;
}
export function generateGroove(analysis,{mode='follow',start=0,end,seed=7,density=.6,strength=.65,swing=0,bpm=100,tempoMode='free'}={}){
 if(analysis?.schema_version!=='offbeat.phrase.v1'||!analysis.source||!Array.isArray(analysis.onsets)||!Array.isArray(analysis.rests))throw Error('Analyze your idea to hear responsive drums.');
 if(!modes.has(mode))throw Error('Choose Follow, Answer or Contrast.');
 if(!Number.isInteger(seed)||seed<0||seed>999999)throw Error('Choose a valid pattern seed.');
 if(![density,strength,swing,bpm,start].every(finite)||!['free','manual'].includes(tempoMode))throw Error('Invalid drum controls.');
 density=clamp(density,0,1);strength=clamp(strength,0,1);swing=clamp(swing,0,.5);
 bpm=clamp(bpm,48,200);
 const duration=analysis.source.duration_s;
 if(!finite(end))end=Math.min(duration,start+12);
 if(start<0||end>duration+.001||end-start<.25)throw Error('Choose a valid phrase longer than a quarter second.');
 end=Math.min(duration,Math.min(end,start+16));
 const length=end-start,rng=seeded(seed),events=[];
 const onsets=analysis.onsets.filter(o=>finite(o.t_s)&&o.t_s>=start&&o.t_s<end&&o.strength>=.06).sort((a,b)=>a.t_s-b.t_s).slice(0,300);
 const rests=analysis.rests.filter(r=>finite(r.start_s)&&finite(r.end_s)&&r.end_s>start&&r.start_s<end&&r.end_s-r.start_s>=.16).sort((a,b)=>a.start_s-b.start_s);
 const pulse=tempoMode==='manual'?60/bpm:pulseFrom(onsets,bpm);
 const put=(kind,time,velocity,origin)=>{
   if(time<0||time>=length-.015||events.length>=248)return;
   if(events.some(e=>e.kind===kind&&Math.abs(e.time_s-time)<.055))return;
   events.push({kind,time_s:round(time),velocity:round(clamp(velocity,.05,1)),origin});
 };
 const probability=clamp(.13+density*.86,0,1);
 const lively=()=>.72+.28*rng();
 if(mode==='follow'){
   // Attacks are copied at source-relative timestamps, never quantized.
   onsets.forEach((onset,i)=>{
     if(i===0||rng()<probability)put('kick',onset.t_s-start,.42+onset.strength*.4*strength,'source_attack');
     if(i%2===1&&rng()<.34+.5*density)put('snare',onset.t_s-start,.25+.48*strength*lively(),'source_attack');
     if(rng()<.25+.55*density)put('hat',onset.t_s-start+.027,.18+.27*strength,'source_attack');
   });
   if(!onsets.length)put('kick',.01,.32+.35*strength,'intro');
 } else if(mode==='answer'){
   // The voice leaves a space; answer inside that silence, not on its attacks.
   put('kick',.01,.22+.25*strength,'intro');
   rests.forEach((rest)=>{
     const from=Math.max(0,rest.start_s-start),to=Math.min(length,rest.end_s-start);
     const room=to-from;
     if(room<.22)return;
     const taps=room>=.72&&density>.45?2:1;
     for(let i=0;i<taps;i++){
       const t=from+room*(i+1)/(taps+1);
       if(rng()<probability+.08)put(i===taps-1?'snare':'hat',t,.25+.52*strength*lively(),'source_rest');
     }
   });
   // Provide a gentle counter-pulse if the analyzer did not find quiet spans.
   if(!events.some(e=>e.origin==='source_rest')){
     for(let t=pulse*.5;t<length-.02;t+=pulse){
       const close=onsets.some(o=>Math.abs(o.t_s-start-t)<.13);
       if(!close&&rng()<.25+density*.55)put('snare',t,.18+.4*strength,'offbeat');
     }
   }
 } else {
   // A tempo pulse is an inferred suggestion unless the user taps a BPM.
   // Swing applies only to these NEW drums; the original take stays untouched.
   put('kick',.012,.26+.38*strength,'intro');
   for(let tick=0;tick<Math.ceil(length/(pulse/2));tick++){
     let time=tick*pulse/2;
     if(tick%2===1)time+=swing*pulse*.45;
     if(time>=length-.02)break;
     if(tick%2===1&&rng()<probability)put('hat',time,.16+.36*strength*lively(),'offbeat');
     if(tick%4===3&&rng()<.32+density*.62)put('snare',time,.22+.55*strength,'offbeat');
     if(tick%4===2&&rng()<.19+density*.44)put('kick',time+.016,.25+.44*strength,'pulse');
   }
 }
 events.sort((a,b)=>a.time_s-b.time_s||a.kind.localeCompare(b.kind));
 const out={schema_version:GROOVE_SCHEMA,engine_version:'0.2.0',source_analysis_id:analysis.analysis_id,
   source_sha256:analysis.source.sha256,mode,seed,density:round(density),strength:round(strength),
   swing:round(swing),tempo:{mode:tempoMode,bpm:round(tempoMode==='manual'?bpm:clamp(60/pulse,48,200))},
   range:{start_s:round(start),end_s:round(end)},events};
 if(!validGroove(out,analysis))throw Error('The drum response could not be validated.');
 return out;
}
