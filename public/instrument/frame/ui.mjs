import {starter,update,setConstraint,seedVariation,compileFrame,diffRender,deformFrame,FrameHistory,validate} from './core.mjs';
import {FrameAudio,downloadBlob} from './audio.mjs';

const $=id=>document.getElementById(id);
const history=new FrameHistory(starter());
let selected='b4',draft=null,drag=null,viewOriginal=false,heard=false,busy=false,revisionCount=0;
let playing=false,seed=0,progress=0,latestDiff=[],saved=[];
let lastBeforeFrame=history.original,lastEditedId='b4',hearing='original';
const LIMIT=8, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const xx=beat=>42+beat*77;
const yy=height=>233-height*165;
const ns='http://www.w3.org/2000/svg';
const audio=new FrameAudio({
 onState:e=>{playing=e.playing;updateTransport();if(playing){hearing=(audio.current?.sourceRevision||0)===0?'original':'variation';}else{$('nextVersion').hidden=true}updateAudition()},
 onLoop:(render,count)=>{
   $('frameCap').textContent='A LITTLE OFFBEAT  /  LOOP '+String(count+1).padStart(2,'0');
   hearing=render.sourceRevision===0?'original':'variation';
   $('nextVersion').hidden=true;updateAudition();
   if(revisionCount>0)status('Now hearing the '+(hearing==='original'?'original':'new variation')+'.');
 },
 onProgress:p=>{
   progress=p;
   const line=$('playhead');
   if(line){const x=xx(0)+p*(xx(8)-xx(0));line.setAttribute('x1',x);line.setAttribute('x2',x)}
 }
});
const now=()=>viewOriginal?history.original:(draft||history.current);
const program=()=>compileFrame(viewOriginal?history.original:history.current);
const base=compileFrame(history.original);
const pointKey=n=>n.id==='b4';
function status(s){$('status').textContent=s}
function updateAudition(){
 const el=$('hearing');if(!el)return;
 el.textContent=!playing?'READY / LISTEN TO EXPLORE':'HEARING / '+(hearing==='original'?'ORIGINAL':'YOUR VERSION');
}
function showChanges(before,after,id){
 const a=compileFrame(before),b=compileFrame(after),changed=diffRender(a,b);
 const oldB=a.bass.find(n=>n.sourceId===id),newB=b.bass.find(n=>n.sourceId===id);
 const oldH=a.harmony.find(n=>n.sourceId===id),newH=b.harmony.find(n=>n.sourceId===id);
 const neighbors=changed.filter(n=>n.kind==='bass'&&n.sourceId!==id).length;
 let bass='BASS · ';
 if(!newB)bass+='SPACE';
 else if(!oldB)bass+='RETURNED';
 else if(newB.frequency===oldB.frequency)bass+=neighbors?'NEIGHBORS MOVED':'PITCH HELD';
 else {
   const steps=Math.max(1,Math.round(Math.abs(12*Math.log2(newB.frequency/oldB.frequency))));
   bass+=(newB.frequency>oldB.frequency?'↑ ':'↓ ')+steps+' STEPS';
   if(neighbors)bass+=' · ELASTIC';
 }
 $('bassChange').textContent=bass;
 $('harmonyChange').textContent='HARMONY · '+(!newH?'REST':!oldH||newH.frequency!==oldH.frequency?'FOLLOWS':'HOLDS');
 const drums=x=>x.drums.filter(n=>n.derivedFromIds?.includes(id)).map(n=>n.id).join(',');
 $('drumChange').textContent=drums(a)!==drums(b)?'DRUMS · NEW ACCENT':'DRUMS · PULSE HELD';
 $('changeStrip').hidden=false;
}
function held(){return history.undoStack.length>0||history.current.revision>0}
function path(points){
 if(!points.length)return '';
 let d='M '+points[0][0].toFixed(2)+' '+points[0][1].toFixed(2);
 for(let i=1;i<points.length;i++){
   const p=points[i-1],n=points[i],mid=(p[0]+n[0])/2;
   d+=' C '+mid.toFixed(2)+' '+p[1].toFixed(2)+' '+mid.toFixed(2)+' '+n[1].toFixed(2)+' '+n[0].toFixed(2)+' '+n[1].toFixed(2);
 }
 return d;
}
function contour(notes,kind){
 let result='',segment=[];
 const emit=()=>{if(segment.length)result+='<path d="'+path(segment)+'" fill="none" class="'+kind+'"/>';segment=[]};
 for(const n of notes){
   if(n.rest){emit();continue}
   segment.push([xx(n.beat),yy(n.height)]);
 }
 emit();return result;
}
function relationY(ev){
 const baseFreq=280;
 const log2=Math.log2(ev.frequency/baseFreq);
 return clamp(284-log2*17,257,316);
}
function draw(){
 const frame=now(),arr=frame.notes.slice().sort((a,b)=>a.beat-b.beat);
 const compiled=compileFrame(frame);
 const svg=$('shape'),active=arr.find(n=>n.id===selected)||arr[0];
 const original=history.original.notes.slice().sort((a,b)=>a.beat-b.beat);
 let h='<defs><linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eab999" stop-opacity=".9"/><stop offset="1" stop-color="#b87d5b" stop-opacity=".93"/></linearGradient></defs>';
 for(let i=0;i<=8;i++){
   const x=xx(i);
   h+='<line x1="'+x+'" y1="30" x2="'+x+'" y2="358" stroke="#edb998" stroke-opacity="'+(i%4===0?.15:.07)+'" stroke-dasharray="'+(i%4===0?'1 0':'2 9')+'"/>';
 }
 for(const y of [83,123,163,203]){
   h+='<line x1="30" x2="673" y1="'+y+'" y2="'+y+'" stroke="#efd3b9" stroke-opacity=".065" stroke-dasharray="2 8"/>';
 }
 h+='<text x="39" y="34" font-size="10" letter-spacing="2" fill="#a78876">BASS / YOUR GESTURE</text>';
 h+='<text x="672" y="34" font-size="10" text-anchor="end" fill="#887365">↑ MORE TENSION</text>';
 // The original remains a faint architectural reference, never overwritten.
 if(held()&&!viewOriginal){
   h+='<path d="'+path(original.map(n=>[xx(n.beat),yy(n.height)]))+'" stroke="#c18d6d" stroke-opacity=".22" fill="none" stroke-width="1.7" stroke-dasharray="3 8"/>';
 }
 h+=contour(arr,'bass-line');
 // Causal relationship rails: visible when selected or editing, subtle otherwise.
 const bassMap=new Map(compiled.bass.map(x=>[x.sourceId,x]));
 const harmonyMap=new Map(compiled.harmony.map(x=>[x.sourceId,x]));
 for(const n of arr){
   const x=xx(n.beat),y=yy(n.height),rel=harmonyMap.get(n.id),related=rel?relationY(rel):284;
   const isSelected=n.id===selected,alpha=isSelected?(drag?.53:.28):.09;
   h+='<path d="M '+x+' '+(y+12)+' C '+(x-12)+' '+(y+35)+' '+(x+10)+' '+(related-25)+' '+x+' '+related+'" stroke="#c9ab93" stroke-opacity="'+alpha+'" stroke-width="'+(isSelected?1.4:.7)+'" fill="none" stroke-dasharray="3 8"/>';
 }
 // The responsive harmonic strand is a dependent system, not a second editor.
 h+='<text x="39" y="269" fill="#a78c79" font-size="9.8" letter-spacing="1.8">HARMONIC RELATION</text>';
 h+='<path d="'+path(compiled.harmony.map(e=>[xx(arr.find(n=>n.id===e.sourceId)?.beat||0),relationY(e)]))+'" stroke="#c7b7a4" stroke-opacity=".7" stroke-width="1.9" fill="none"/>';
 for(const e of compiled.harmony){
   const x=xx(arr.find(n=>n.id===e.sourceId)?.beat||0),y=relationY(e);
   h+='<circle cx="'+x+'" cy="'+y+'" r="'+(e.sourceId===selected?3.7:2.5)+'" fill="#d7c2ae" fill-opacity="'+(e.sourceId===selected?.92:.5)+'"/>';
 }
 h+='<text x="39" y="333" font-size="9.8" fill="#a78c79" letter-spacing="1.8">PULSE / RESPONSIVE ACCENTS</text>';
 const drums=compiled.drums.filter(e=>e.kind==='kick'||e.kind==='snare'||(e.kind==='hat'&&e.reason!=='pulse'));
 for(const e of drums){
   const x=xx(e.beat),hei=e.kind==='kick'?15:e.kind==='snare'?11:7,
       relation=e.derivedFromIds?.length>0;
   h+='<rect x="'+(x-5.5)+'" y="'+(352-hei)+'" width="11" height="'+hei+'" rx="2.5" fill="'+(relation?'#dca17e':e.kind==='kick'?'#a67658':'#8c8174')+'" fill-opacity="'+(relation?1:.76)+'"/>';
 }
 // Ghost and edit nodes — entire vertical column is a generous gesture target.
 for(const n of arr){
   const x=xx(n.beat),y=yy(n.height),isSelected=n.id===selected;
   const fill=n.rest?'#241b17':isSelected?'url(#warm)':'#ad7f64';
   if(isSelected){
     h+='<circle cx="'+x+'" cy="'+y+'" r="24" fill="#dda27e" fill-opacity=".085"/>';
     h+='<circle cx="'+x+'" cy="'+y+'" r="15" fill="none" stroke="#e2aa86" stroke-opacity=".45" stroke-width="1"/>';
   }
   h+='<circle cx="'+x+'" cy="'+y+'" r="'+(isSelected?9.3:5.2)+'" fill="'+fill+'" stroke="'+(isSelected?'#f3c9a9':'#c09379')+'" stroke-width="'+(isSelected?1.5:.9)+'" '+(n.rest?'stroke-dasharray="3 3"':'')+'/>';
   if(isSelected){
     h+='<circle cx="'+x+'" cy="'+y+'" r="2.2" fill="#fbe2cd"/>';
     const endX=x+n.duration*77,endY=y+27;
     h+='<line x1="'+x+'" y1="'+endY+'" x2="'+endX+'" y2="'+endY+'" stroke="#c99677" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/>';
     h+='<circle cx="'+endX+'" cy="'+endY+'" r="5" fill="#d7a17e"/>';
     h+='<circle data-action="stretch" data-note="'+n.id+'" cx="'+endX+'" cy="'+endY+'" r="17" fill="transparent"/>';
     h+='<text x="'+clamp(x+15,38,580)+'" y="'+clamp(y-21,48,225)+'" font-size="10" letter-spacing="1.4" fill="#f0c4a4">YOUR MOVE</text>';
   }
 }
 const playX=xx(0)+progress*(xx(8)-xx(0));
 h+='<line id="playhead" x1="'+playX+'" y1="43" x2="'+playX+'" y2="356" stroke="#e4ad86" stroke-opacity="'+(playing?.56:0)+'" stroke-width="1.2"/>';
 h+='<text x="669" y="371" font-size="9.5" fill="#967c6a" text-anchor="end">2 BARS · 96 BPM</text>';
 svg.innerHTML=h;
}
function queue(){
 const next=program();
 audio.queue(next);
 $('instruction').textContent=playing?'The groove updates on the next loop.':'Hit play to hear what changed.';
 if(playing)status('New relationship queued · It will land on the next loop.');
 else status('A new possibility. Press play to hear the whole change.');
}
function adjust(next,label,sourceId){
 if(viewOriginal)viewOriginal=false;
 const previous=compileFrame(history.current);
 const committed=history.commit(next);if(!committed)return;
 latestDiff=diffRender(previous,compileFrame(history.current));
 revisionCount++;draft=null;
 updateUI();queue();
 const n=compileFrame(history.current).bass.find(e=>e.sourceId===(sourceId||selected));
 if(n)audio.preview(n);
 $('prompt').textContent=label||'What else could move?';
 $('promptDetail').textContent='Compare it with the original, or change another relationship.';
}
function updateTransport(){
 $('transport').innerHTML=playing?'Ⅱ &nbsp; PAUSE GROOVE':heard?'▶ &nbsp; HEAR GROOVE':'▶ &nbsp; START LISTENING';
 $('playingLabel').textContent=playing?'THE GROOVE IS MOVING':heard?'READY TO HEAR AGAIN':'READY TO EXPLORE';
 $('playingLabel').classList.toggle('playing',playing);
 $('frameCap').textContent=playing?'A LITTLE OFFBEAT — LOOPING':'A LITTLE OFFBEAT — 2 BARS';
}
function updateUI(){
 const can=held();
 $('original').disabled=!can;
 $('undo').disabled=!history.undoStack.length;
 $('redo').disabled=!history.redoStack.length;
 $('compareOriginal').disabled=!can;
 $('compareYours').disabled=!can;
 $('compareOriginal').setAttribute('aria-pressed',String(viewOriginal));
 $('compareYours').setAttribute('aria-pressed',String(!viewOriginal));
 ['pulse','harmony','feel'].forEach(name=>{
   const node=$('lock'+name.charAt(0).toUpperCase()+name.slice(1));
   const on=history.current.constraints[name];
   node.setAttribute('aria-pressed',String(on));
   node.textContent=(name==='pulse'?'↔ ':name==='harmony'?'◇ ':'∿ ')+name.toUpperCase()+' · '+(on?'ON':'OFF');
 });
 const n=now().notes.find(n=>n.id===selected);
 $('space').textContent=n?.rest?'↶ RESTORE NOTE':'○ LEAVE A SPACE';
 draw();
}
function showOriginal(original){
 if(original===viewOriginal)return;
 viewOriginal=original;draft=null;audio.queue(program());
 updateUI();
 status(original?'You can always return to this.':'Back to your variation.');
 $('prompt').textContent=original?'The starting point.':'Your version.';
 $('promptDetail').textContent=original?'The original stays here while you explore.':'Change it again. Nothing is final.';
}
function toggle(name){
 const frame=history.current,val=!frame.constraints[name];
 const next=setConstraint(frame,name,val);
 adjust(next,name==='harmony'?(val?'Harmony follows your shape.':'Harmony is free to stay put.'):
    name==='pulse'?(val?'Keep the groove together.':'Let the rhythm move with the bass.'):
    (val?'Keep your feel.':'Let timing settle.'),selected);
}
function chooseNoteNear(x){
 const notes=now().notes;
 return [...notes].sort((a,b)=>Math.abs(xx(a.beat)-x)-Math.abs(xx(b.beat)-x))[0];
}
function coord(evt){
 const box=$('shape').getBoundingClientRect();
 return {x:(evt.clientX-box.left)/box.width*700,y:(evt.clientY-box.top)/box.height*382};
}
const shape=$('shape');
shape.addEventListener('pointerdown',e=>{
 if(busy)return;
 const p=coord(e);
 if(p.y>261||p.y<30)return;
 const target=e.target;
 const handle=target?.getAttribute?.('data-action')==='stretch';
 const n=handle?now().notes.find(n=>n.id===target.getAttribute('data-note')):chooseNoteNear(p.x);
 if(!n)return;
 selected=n.id;
 if(viewOriginal)viewOriginal=false;
 drag={id:n.id,kind:handle?'stretch':'pitch',start:p,initial:history.current,origin:n,
   moved:false,pointerId:e.pointerId};
 try{shape.setPointerCapture(e.pointerId)}catch{}
 e.preventDefault();updateUI();
});
shape.addEventListener('pointermove',e=>{
 if(!drag||drag.pointerId!==e.pointerId)return;
 const p=coord(e);
 const difference=Math.abs(p.y-drag.start.y)+Math.abs(p.x-drag.start.x);
 if(difference>6)drag.moved=true;
 if(!drag.moved)return;
 const next=drag.kind==='stretch'?
   update(drag.initial,drag.id,{duration:clamp(drag.origin.duration+(p.x-drag.start.x)/77,.15,1.45)}):
   update(drag.initial,drag.id,{height:clamp(drag.origin.height-(p.y-drag.start.y)/165,.02,.98)});
 draft=next;draw();e.preventDefault();
});
function endDrag(e){
 if(!drag||drag.pointerId!==e.pointerId)return;
 const old=drag;drag=null;
 try{shape.releasePointerCapture(e.pointerId)}catch{}
 if(old.moved&&draft){
   adjust(draft,old.kind==='stretch'?'You stretched the phrase.':'You changed the whole relationship.',old.id);
 }else{
   draft=null;updateUI();status('Selected a point · Pull it to hear what changes.');
 }
}
shape.addEventListener('pointerup',endDrag);
shape.addEventListener('pointercancel',()=>{drag=null;draft=null;updateUI()});
shape.addEventListener('keydown',(event)=>{
 const key=event.key;
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(key))return;
 event.preventDefault();
 const current=history.current.notes.find(note=>note.id===selected);
 if(!current)return;
 if(key==='Enter'||key===' '){
   const next=update(history.current,selected,{rest:!current.rest});
   adjust(next,'Silence becomes part of the groove.');
   return;
 }
 if(key==='ArrowUp'||key==='ArrowDown'){
   const step=event.shiftKey?0.22:0.13;
   const direction=key==='ArrowUp'?1:-1;
   const next=update(history.current,selected,{height:current.height+direction*step});
   adjust(next,'A small move changes the sound.');
   return;
 }
 const delta=key==='ArrowRight'?0.14:-0.14;
 const next=update(history.current,selected,{duration:current.duration+delta});
 adjust(next,'You changed how long the note stays.');
});
$('transport').addEventListener('click',async ()=>{
 if(busy)return;
 if(playing){audio.stop();status('Paused. Your form is still here.');return}
 busy=true;$('transport').disabled=true;$('transport').textContent='♫ LOADING REAL BASS…';
 try{
   await audio.resume(program());heard=true;
   $('introHelp').textContent='Touch a point, move it, and listen to the relationships shift.';
   $('prompt').textContent=held()?'What happens if you change it again?':'What if this went higher?';
   $('promptDetail').textContent='Move the glowing point. The whole arrangement responds.';
   $('instruction').textContent='Move a point. The other layers respond.';
   status('Playing / A little offbeat.');
 }catch(error){status(error.message||'Could not start audio.');}
 finally{busy=false;$('transport').disabled=false;updateTransport()}
});
$('higher').addEventListener('click',()=>{
 const n=history.current.notes.find(n=>n.id===selected);
 if(!n)return;
 adjust(update(history.current,selected,{height:clamp(n.height+.27,0,1)}),'Higher. What else could move?');
});
$('space').addEventListener('click',()=>{
 const n=history.current.notes.find(n=>n.id===selected);
 if(!n)return;
 adjust(update(history.current,selected,{rest:!n.rest}),n.rest?'The note is back.':'Now there is room to breathe.');
});
$('another').addEventListener('click',()=>{
 seed++;
 adjust(seedVariation(history.current,seed),'Another possibility, same starting idea.','b4');
});
$('undo').addEventListener('click',()=>{
 if(!history.undo())return;
 draft=null;viewOriginal=false;updateUI();queue();status('Undo. The previous version is back.');
});
$('redo').addEventListener('click',()=>{
 if(!history.redo())return;
 viewOriginal=false;updateUI();queue();status('Redo. Your variation is restored.');
});
$('original').addEventListener('click',()=>showOriginal(!viewOriginal));
$('compareOriginal').addEventListener('click',()=>showOriginal(true));
$('compareYours').addEventListener('click',()=>showOriginal(false));
for(const k of ['pulse','harmony','feel']){
 $('lock'+k[0].toUpperCase()+k.slice(1)).addEventListener('click',()=>toggle(k));
}
function renderSavedVersions(){
 const host=$('saved');host.replaceChildren();
 history.variants.forEach(variation=>{
   const button=document.createElement('button');
   button.type='button';button.textContent='VERSION '+variation.id;
   button.title='Revisit version '+variation.id;
   button.addEventListener('click',()=>{
     const copied=structuredClone(variation.frame);
     const next={...copied,revision:history.current.revision+1,parentRevision:history.current.revision};
     adjust(next,'You returned to an idea you kept.');
     status('Version '+variation.id+' loaded · Keep changing it.');
   });
   host.appendChild(button);
 });
}
$('keep').addEventListener('click',()=>{
 const v=history.save();saved=history.variants;
 try{localStorage.setItem('offbeat.form.frame.variants.v1',JSON.stringify(saved))}catch{}
 renderSavedVersions();
 status('Kept variation '+v.id+' on this device.');
});
$('export').addEventListener('click',async ()=>{
 const b=$('export');b.disabled=true;b.textContent='RENDERING…';
 try{
   const blob=await audio.exportWav(program());
   downloadBlob(blob,'FORM-007-'+(viewOriginal?'ORIGINAL':'VARIATION')+'.wav');
   status('WAV ready. Original relationships preserved.');
 }catch(e){status('Export failed: '+e.message)}
 finally{b.disabled=false;b.textContent='↓ EXPORT WAV'}
});
window.addEventListener('pagehide',()=>audio.dispose());
window.addEventListener('visibilitychange',()=>{
 if(document.hidden&&playing){audio.stop();status('Paused while you were away.')}
});
try{
 const found=JSON.parse(localStorage.getItem('offbeat.form.frame.variants.v1')||'[]');
 if(Array.isArray(found)){
   history.variants=found.filter(v=>v&&typeof v.id==='string'&&v.id.length<6&&validate(v.frame)).slice(-4);
   history.variantCounter=Math.max(0,...history.variants.map(v=>{
     return /^[A-Z]$/.test(v.id)?v.id.charCodeAt(0)-64:Number(String(v.id).replace(/^V/,'')||0);
   }));
   saved=history.variants.slice();renderSavedVersions();
 }
}catch{history.variants=[]}
updateUI();updateTransport();
