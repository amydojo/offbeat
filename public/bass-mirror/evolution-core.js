/* OFFBEAT Musical Evolution v1 — pure, deterministic, eight-bar phrase development.
   Data source: 16-step sample sequence (not transcription of original raw performances).
   No audio/DOM dependencies; suitable for tests and export/live shared scheduling. */
(function(root){
'use strict';
const IDS=['low','pulse','rise','spark','other','shift','knock','tick','scrape'];
const BASS=IDS.slice(0,6);
const PERC=IDS.slice(6);
const PHASES=[
 {name:'FIND',detail:'Meet the idea',change:'Original phrase'},
 {name:'HOLD',detail:'Keep it familiar',change:'Exact repeat'},
 {name:'ANSWER',detail:'A note answers',change:'One new bass hit'},
 {name:'BEND',detail:'Move the emphasis',change:'One timing shift'},
 {name:'SPACE',detail:'Let it breathe',change:'A note drops away'},
 {name:'WANDER',detail:'Explore an edge',change:'Subtle change + texture'},
 {name:'RECALL',detail:'Recognize the idea',change:'Mostly familiar'},
 {name:'RETURN',detail:'Back to your riff',change:'Original phrase'}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const copy=o=>JSON.parse(JSON.stringify(o));
const normalized=p=>{
 const o={};
 for(const id of IDS){
  const values=Array.isArray(p&&p[id])?p[id]:[];
  o[id]=[...new Set(values.filter(v=>Number.isInteger(v)&&v>=0&&v<16))].sort((a,b)=>a-b);
 }
 return o;
};
const signature=p=>IDS.map(id=>id+':'+(p[id]||[]).join(',')).join('|');
const at=(p,id,n)=>p[id].includes(n);
const add=(p,id,n)=>{if(n<0||n>15||at(p,id,n))return false;p[id].push(n);p[id].sort((a,b)=>a-b);return true};
const remove=(p,id,n)=>{if(!at(p,id,n))return false;p[id]=p[id].filter(x=>x!==n);return true};
const move=(p,id,from,to)=>{
 if(from===to||!at(p,id,from)||at(p,id,to)||to<0||to>15)return false;
 remove(p,id,from);add(p,id,to);return true;
};
const bassBusy=(p,n)=>BASS.some(id=>at(p,id,n));
function chooseAnchor(base){
 const rank=BASS.map((id,i)=>({id,count:base[id].length,i,atZero:base[id].includes(0)?1:0}));
 rank.sort((a,b)=>b.count-a.count||b.atZero-a.atZero||a.i-b.i);
 return rank[0].count?rank[0].id:null;
}
function chooseResponse(p,protectedId){
 const opts=['spark','rise','other','shift','pulse','low'].filter(id=>id!==protectedId);
 for(const n of [14,12,13,15,11,10,9,7]){
  if(bassBusy(p,n))continue;
  for(const id of opts){if(add(p,id,n))return {kind:'add',id,to:n}}
 }
 return null;
}
function chooseShift(p,protectedId){
 const ids=['rise','pulse','other','shift','spark','low'].filter(id=>id!==protectedId);
 for(const id of ids){
  for(const step of p[id]){
   for(const delta of [1,-1,2,-2]){
    const next=step+delta;
    if(Math.floor(step/4)!==Math.floor(next/4))continue;
    if(move(p,id,step,next))return {kind:'move',id,from:step,to:next};
   }
  }
 }
 return null;
}
function chooseSilence(p,protectedId){
 const ids=['spark','other','rise','shift','pulse','low'].filter(id=>id!==protectedId);
 for(const id of ids){
  const n=p[id].slice().sort((a,b)=>b-a)[0];
  if(n!==undefined&&remove(p,id,n))return {kind:'remove',id,from:n};
 }
 return null;
}
function chooseTexture(p){
 for(const id of ['tick','scrape','knock']){
  for(const n of [14,6,10,3,12])if(add(p,id,n))return {kind:'texture',id,to:n};
 }
 return null;
}
function changeCount(a,b){
 return IDS.reduce((sum,id)=>{
  const aa=new Set(a[id]),bb=new Set(b[id]);
  return sum+[...aa].filter(x=>!bb.has(x)).length+[...bb].filter(x=>!aa.has(x)).length;
 },0);
}
function compose(raw){
 const base=normalized(raw),anchor=chooseAnchor(base);
 const bars=PHASES.map((phase,i)=>({index:i,name:phase.name,detail:phase.detail,change:phase.change,pattern:copy(base),edits:[]}));
 const apply=(index,fn)=>{
  const operation=fn(bars[index].pattern,anchor);
  if(operation)bars[index].edits.push(operation);
 };
 // A composition has a distinct opening, development and clean return.
 apply(2,chooseResponse);
 apply(3,chooseShift);
 apply(4,chooseSilence);
 apply(5,chooseShift);
 // Texture accents are deliberately quieter than original samples.
 apply(5,chooseTexture);
 apply(6,chooseResponse);
 for(const b of bars){
  b.difference=changeCount(base,b.pattern);
  b.bassCount=BASS.reduce((sum,id)=>sum+b.pattern[id].length,0);
  b.events=IDS.reduce((sum,id)=>sum+b.pattern[id].length,0);
  b.change=b.edits.length?b.edits.map(e=>{
   const from=e.from===undefined?'':String(e.from+1).padStart(2,'0');
   const to=e.to===undefined?'':String(e.to+1).padStart(2,'0');
   return e.kind==='add'?'Add '+e.id.toUpperCase()+' at '+to:
    e.kind==='texture'?'Texture '+e.id.toUpperCase()+' at '+to:
    e.kind==='remove'?'Rest '+e.id.toUpperCase()+' at '+from:
    'Shift '+e.id.toUpperCase()+' '+from+' → '+to;
  }).join(' · '):b.change;
 }
 return {bars,anchor,base,signature:signature(base),length:8,stepsPerBar:16};
}
function eventsAt(plan,absoluteStep){
 if(!plan||!Number.isFinite(absoluteStep))return [];
 const barIndex=Math.floor(Math.max(0,absoluteStep)/16)%8;
 const step=Math.max(0,Math.floor(absoluteStep))%16;
 const bar=plan.bars[barIndex];
 const notes=[];
 for(const id of IDS)if(bar.pattern[id].includes(step)){
  const percussion=PERC.includes(id);
  // Additions are intentional lighter accents, not new dominant bass anchors.
  const changed=bar.edits.some(e=>(e.kind==='add'||e.kind==='texture')&&e.id===id&&e.to===step);
  notes.push({id,velocity:percussion?(changed?.40:.62):(changed?.55:.76),step,bar:barIndex});
 }
 return notes;
}
const api=Object.freeze({IDS,BASS,PHASES,normalize:normalized,signature,compose,eventsAt,changeCount,clamp});
root.OFFBEAT_EVOLUTION_CORE=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);