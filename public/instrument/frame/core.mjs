// FORM 007 / Groove Frame — deterministic, immutable music relationships.
export const SCHEMA='offbeat.form.frame.v1';
export const ENGINE='0.7.0';
export const BEATS=8;
export const TONIC='D';
export const SCALE=[73.416,87.307,97.999,110,130.813,146.832,174.614,195.998];
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const round=(n)=>Number(n.toFixed(5));
const seedBeat=[
 ['b0',0,.20,.68,0.68],['b1',.85,.20,.35,.52],
 ['b2',1.5,.35,.58,.78],['b3',2.5,.48,.70,.63],
 ['b4',3.5,.66,.40,.79],['b5',4.25,.46,.53,.72],
 ['b6',5.5,.30,.65,.68],['b7',6.75,.20,.72,.63]
];
function note(id,beat,height,duration,velocity){
 return {id,beat,height,duration,velocity,rest:false,delay:0};
}
export function starter(){
 return {schema:SCHEMA,frameId:'a-little-offbeat-01',revision:0,parentRevision:null,seed:17,
  name:'A LITTLE OFFBEAT',bpm:96,bars:2,beats:BEATS,
  harmonyMode:'guided',constraints:{pulse:true,harmony:true,feel:true},
  notes:seedBeat.map((n,i)=>({...note(...n),delay:[0,-.022,.033,-.015,.021,-.03,.028,-.018][i]}))};
}
export function validate(frame){
 return !!(frame&&frame.schema===SCHEMA&&frame.bpm>=48&&frame.bpm<=200&&frame.beats===8&&
   frame.notes?.length>0&&frame.notes.length<=20&&
   ['guided','free'].includes(frame.harmonyMode)&&
   frame.notes.every(n=>n&&typeof n.id==='string'&&Number.isFinite(n.beat)&&n.beat>=0&&n.beat<8&&
     Number.isFinite(n.height)&&n.height>=0&&n.height<=1&&
     Number.isFinite(n.duration)&&n.duration>.08&&n.duration<=2&&
     Number.isFinite(n.velocity)&&n.velocity>=0&&n.velocity<=1&&
     typeof n.rest==='boolean')&&
   new Set(frame.notes.map(n=>n.id)).size===frame.notes.length);
}
export function update(frame,id,patch){
 if(!validate(frame))throw new Error('Invalid musical frame');
 if(!frame.notes.some(n=>n.id===id))throw new Error('Unknown bass gesture');
 const next={...frame,revision:frame.revision+1,parentRevision:frame.revision,
   notes:frame.notes.map(n=>n.id!==id?n:{
      ...n,
      ...(patch.height!==undefined?{height:round(clamp(patch.height,0,1))}:{}),
      ...(patch.beat!==undefined?{beat:round(clamp(patch.beat,0,7.9))}:{}),
      ...(patch.duration!==undefined?{duration:round(clamp(patch.duration,.12,1.45))}:{}),
      ...(patch.rest!==undefined?{rest:!!patch.rest}:{}),
    })};
 return next;
}
export function setConstraint(frame,key,value){
 if(!['pulse','harmony','feel'].includes(key))throw new Error('Unknown relationship');
 return {...frame,revision:frame.revision+1,parentRevision:frame.revision,
  harmonyMode:key==='harmony'?(value?'guided':'free'):frame.harmonyMode,
  constraints:{...frame.constraints,[key]:!!value}};
}
export function seedVariation(frame,seed){
 const chosen=frame.notes.find(n=>n.id==='b4')||frame.notes[Math.floor(frame.notes.length/2)];
 const moves=[-.27,.26,-.17,.38,-.34,.17];const shift=moves[((seed%moves.length)+moves.length)%moves.length];
 const result=update(frame,chosen.id,{height:clamp(chosen.height+shift,.04,.96)});
 return {...result,seed,revision:frame.revision+1,parentRevision:frame.revision};
}
export function heightToIndex(h){return Math.max(0,Math.min(7,Math.round(clamp(h,0,1)*7)))}
export function pitchOf(height,harmony=true){
 if(harmony)return SCALE[heightToIndex(height)];
 return 65.406*Math.pow(2,1.59*clamp(height,0,1));
}
const dur=(beat,bpm)=>beat*60/bpm;
export function compileFrame(frame){
 if(!validate(frame))throw new Error('Cannot compile invalid groove frame');
 const bpm=frame.bpm,free=frame.harmonyMode==='free'||!frame.constraints.harmony;
 const ordered=[...frame.notes].sort((a,b)=>a.beat-b.beat||a.id.localeCompare(b.id));
 const bass=ordered.filter(n=>!n.rest).map((n,i)=>({
   id:'bass:'+n.id,sourceId:n.id,kind:'bass',origin:'user',
   time:round(dur(n.beat+(frame.constraints.feel?n.delay:0),bpm)),
   duration:round(dur(n.duration,bpm)),beat:n.beat,
   frequency:round(pitchOf(n.height,!free)),
   sampleP:free?n.height:heightToIndex(n.height)/7,
   free,velocity:n.velocity,
   height:n.height
 }));
 const response=ordered.filter(n=>!n.rest).map(n=>{
   const idx=heightToIndex(n.height);
   // A little upper voice follows each authored gesture, with intentional space
   // and low volume; harmony OFF freezes relationships to the original preset.
   const harmonicIdx=free?heightToIndex(seedBeat.find(seed=>seed[0]===n.id)?.[3]??.4):idx;
   const upper=SCALE[Math.min(7,harmonicIdx+2)]*2;
   return {id:'harm:'+n.id,sourceId:n.id,origin:'generated',kind:'harmony',
    derivedFromIds:[n.id],time:round(dur(n.beat,bpm)),
    duration:round(Math.min(.52,dur(n.duration+.1,bpm))),
    frequency:round(upper),velocity:round(.115+n.velocity*.085)};
 });
 const drums=[];const add=(kind,beat,velocity,why,parent)=>{
   if(beat<0||beat>=8)return;
   const existing=drums.find(d=>d.kind===kind&&Math.abs(d.beat-beat)<.07);
   if(existing)return;
   drums.push({id:'drum:'+kind+':'+round(beat),kind,beat:round(beat),time:round(dur(beat,bpm)),
      velocity:round(velocity),origin:'generated',derivedFromIds:parent?[parent]:[],reason:why});
 };
 // Locked pulse preserves the recurring backbeat. Unlocked pulse can instead
 // follow the authored bass onsets (still inside the two-bar frame).
 if(frame.constraints.pulse){
   [0,2.5,4,6.5].forEach((b,i)=>add('kick',b,i===0?.68:.46,'pulse'));
   [1,3,5,7].forEach(b=>add('snare',b,.38,'pulse'));
   for(let b=.5;b<8;b+=.5)add('hat',b,b%1===0?.14:.23,'pulse');
 }else{
   const active=ordered.filter(n=>!n.rest);
   active.filter((n,i)=>i%2===0).forEach((n,i)=>add('kick',n.beat,i===0?.62:.43,'authored_pulse',n.id));
   active.filter((n,i)=>i%2===1).forEach(n=>add('snare',n.beat,.36,'authored_pulse',n.id));
   active.forEach(n=>add('hat',n.beat+.24,.19,'authored_pulse',n.id));
 }
 for(let i=0;i<ordered.length;i++){
   const n=ordered[i];if(n.rest)continue;
   if(n.beat%1!==0&&n.velocity>.61){
     add('hat',n.beat+.10,round(.16+n.velocity*.12),'source_attack',n.id);
   }
   if(n.id==='b4'&&n.height>.77)add('kick',n.beat+.25,.32,'high_phrase_response',n.id);
   if(n.id==='b4'&&n.height<.26)add('hat',n.beat+.25,.18,'low_phrase_response',n.id);
 }
 drums.sort((a,b)=>a.time-b.time||a.kind.localeCompare(b.kind));
 return {schema:'offbeat.form.frame.render.v1',frameId:frame.frameId,
   sourceRevision:frame.revision,seed:frame.seed,bpm,bars:frame.bars,
   duration:round(dur(8,bpm)),bass,harmony:response,drums,
   events:[...bass,...response,...drums].sort((a,b)=>a.time-b.time)};
}
export function diffRender(a,b){
 const before=new Map([...a.bass,...a.harmony,...a.drums].map(e=>[e.id,e]));
 return [...b.bass,...b.harmony,...b.drums].filter(x=>{
   const y=before.get(x.id);
   return !y||JSON.stringify(x)!==JSON.stringify(y);
 }).map(e=>({id:e.id,kind:e.kind,sourceId:e.sourceId||e.derivedFromIds?.[0]||null}));
}
export class FrameHistory{
 constructor(initial=starter()){this.original=structuredClone(initial);this.current=structuredClone(initial);this.undoStack=[];this.redoStack=[];this.variants=[]}
 commit(next){
   if(!validate(next))throw new Error('Refusing invalid edit');
   if(JSON.stringify(next)===JSON.stringify(this.current))return false;
   this.undoStack.push(structuredClone(this.current));
   if(this.undoStack.length>32)this.undoStack.shift();
   this.current=structuredClone(next);this.redoStack=[];return true;
 }
 undo(){if(!this.undoStack.length)return false;this.redoStack.push(this.current);this.current=this.undoStack.pop();return true}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push(this.current);this.current=this.redoStack.pop();return true}
 revert(){return this.commit(this.original)}
 save(){const label=String.fromCharCode(65+this.variants.length);const v={id:label,frame:structuredClone(this.current)};
   this.variants=[...this.variants.slice(-3),v];return v}
}
