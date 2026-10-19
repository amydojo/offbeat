// FORM 009 / physical musical relationship instrument.
// Drawing is intrinsic to music state. Rendering is not merely audio-reactive.
import {starter,FrameHistory,validate,setConstraint,diffRender} from '../frame/core.mjs';
import {FrameAudio,downloadBlob} from '../frame/audio.mjs';
import {sampleGesture,applyGesture,chooseAnchor,compilePhysical,physicsStep} from './physics.mjs';

const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const history=new FrameHistory(starter());
const canvas=$('sculpture'),brush=canvas.getContext('2d',{alpha:true});
const stage=$('stage'),chipHost=$('gestureList');
let memory=[],snapshots=[],lastBefore=history.original,lastAnchor='b4',gesture=null;
let drag=null,pointer=null,playing=false,ready=false,busy=false,compareOriginal=false;
let progress=0,queued=false,heard='ORIGINAL',lastMoveAt=0,pulse=0,spring={x:0,y:0,vx:0,vy:0},lastFrame=0;
let frameCount=0,saveTimer=0;

const audio=new FrameAudio({
 onState(s){playing=s.playing;ready=s.ready;updatePlayer()},
 onLoop(render){
   queued=false;heard=render.sourceRevision===0?'ORIGINAL':'YOUR VERSION';
   updatePlayer();updateComparisonLabel();
   $('status').textContent='Now hearing '+(heard==='ORIGINAL'?'the original':'your variation')+'.';
 },
 onProgress(p){progress=p;$('progress').style.width=(p*100).toFixed(1)+'%'}
});

function activeFrame(){return compareOriginal?history.original:history.current}
function program(){return compilePhysical(activeFrame())}
function status(s){$('status').textContent=s}
function updatePlayer(){
 $('play').textContent=busy?'♫ LOADING…':playing?'Ⅱ  PAUSE THE GROOVE':'▶  HEAR THE GROOVE';
 $('playingState').textContent=playing?'GROOVE / PLAYING':'GROOVE / PAUSED';
 $('undo').disabled=!history.undoStack.length;
 $('reset').disabled=history.current.revision===0;
 $('original').disabled=history.current.revision===0;
 $('yours').disabled=history.current.revision===0;
 $('original').setAttribute('aria-pressed',String(compareOriginal));
 $('yours').setAttribute('aria-pressed',String(!compareOriginal));
}
function updateComparisonLabel(){
 $('hearing').textContent=playing?'HEARING / '+heard:'READY / PRESS PLAY';
 $('queued').hidden=!playing||!queued;
 $('queued').textContent='NEXT LOOP / '+(compareOriginal?'ORIGINAL':'YOUR VERSION');
}
function enqueue(){
 audio.queue(program());queued=playing;
 updateComparisonLabel();
}
function updateChanges(before,after,anchor){
 const a=compilePhysical(before),b=compilePhysical(after);
 const old=a.bass.find(x=>x.sourceId===anchor),next=b.bass.find(x=>x.sourceId===anchor);
 const oldHarmony=a.harmony.find(x=>x.sourceId===anchor),harmony=b.harmony.find(x=>x.sourceId===anchor);
 let bass='STILL';
 if(!next)bass='LEFT A SPACE';
 else if(!old)bass='NOTE RETURNED';
 else if(next.frequency!==old.frequency)bass=next.frequency>old.frequency?'PULLED HIGHER':'PULLED LOWER';
 else if(next.duration!==old.duration)bass=next.duration>old.duration?'STRETCHED':'COMPRESSED';
 else if(next.velocity!==old.velocity)bass='NEW ENERGY';
 const extras=a.physicalResponses.map(x=>x.id).join('|')!==b.physicalResponses.map(x=>x.id).join('|');
 $('bassResponse').textContent=bass;
 $('harmonyResponse').textContent=!harmony?'REST':
   !oldHarmony||oldHarmony.frequency!==harmony.frequency?'MOVED WITH YOU':'HELD ITS PLACE';
 $('rhythmResponse').textContent=extras?'NEW ACCENT':'PULSE HOLDS';
 $('responseTitle').textContent='One pull. A new relationship.';
 $('responseText').textContent=extras?
  'The bass shifted, harmony found a new position, and your release invited a rhythmic answer.':
  'The bass and its supporting harmony respond. The underlying pulse stays yours to keep or unlock.';
}
function persist(){
 try{
   const document={schema:'offbeat.form.gesture.v1',frame:history.current,
     snapshots:snapshots.slice(-12),memory:memory.slice(-16)};
   localStorage.setItem('offbeat.form.gesture.v1',JSON.stringify(document));
 }catch{}
}
function recordMemory(g,frame){
 const index=memory.length+1;
 memory.push({id:'m'+index,gesture:g,frame:structuredClone(frame)});
 if(memory.length>16)memory.shift();
 snapshots.push({id:'g'+index,frame:structuredClone(frame)});
 if(snapshots.length>12)snapshots.shift();
 renderMemory();persist();
}
function renderMemory(){
 chipHost.replaceChildren();
 memory.slice(-8).forEach((m,i)=>{
   const el=document.createElement('button');
   el.type='button';el.className='gesture-chip';
   el.textContent=String(Math.max(1,memory.length-7+i)).padStart(2,'0');
   el.title='Return to gesture '+(i+1);
   el.setAttribute('aria-label','Restore musical gesture '+(i+1));
   el.addEventListener('click',()=>{
     const before=history.current;
     const frame={...structuredClone(m.frame),revision:before.revision+1,parentRevision:before.revision};
     if(!history.commit(frame))return;
     compareOriginal=false;lastBefore=before;
     lastAnchor=m.gesture.anchor||chooseAnchor(frame,m.gesture.originX);
     enqueue();updateChanges(before,frame,lastAnchor);updatePlayer();
     audio.previewChange(compilePhysical(frame),lastAnchor);
     status('Gesture '+(i+1)+' returned. This is another branch; nothing was erased.');
     persist();
   });
   chipHost.appendChild(el);
 });
 $('memoryInfo').textContent=memory.length?
  memory.length+' gestures. Each one records how you pulled, not just which note you landed on. Touch a number to revisit it.':
  'Every gesture leaves a trace. Touch one to revisit the musical decision.';
}
function coords(e){
 const rect=canvas.getBoundingClientRect();
 return {x:clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1),
         y:clamp((e.clientY-rect.top)/Math.max(1,rect.height),0,1)};
}
async function ensureSound(){
 try{
   await audio.ensureAudio();ready=true;return true;
 }catch(err){
   status(err?.message||'Sound is unavailable.');
   return false;
 }
}
function begin(e){
 if(pointer!==null)return;
 if(e.pointerType==='mouse'&&e.button!==0)return;
 e.preventDefault();
 pointer=e.pointerId;
 const start=coords(e);
 drag={startX:e.clientX,startY:e.clientY,x:start.x,y:start.y,
       started:performance.now(),travel:0,lastX:e.clientX,lastY:e.clientY,
       prior:history.current,anchor:chooseAnchor(history.current,start.x),
       params:sampleGesture({originX:start.x}),moved:false};
 gesture=drag.params;
 try{canvas.setPointerCapture(e.pointerId)}catch{}
 canvas.classList.add('is-held');stage.classList.add('is-held');
 $('gestureName').textContent='TENSION / LIVE';
 $('gestureHint').textContent='Pull. The other parts are listening.';
 // AudioContext is unlocked inside the genuine gesture when possible.
 if(!ready)ensureSound().then(ok=>{if(ok&&drag&&drag.moved)previewFinger()});
}
function previewFinger(){
 if(!drag||!ready)return;
 const next=applyGesture(drag.prior,drag.params,drag.anchor);
 const note=next.notes.find(n=>n.id===drag.anchor);
 if(note)audio.sculpt(note.height);
}
function move(e){
 if(!drag||e.pointerId!==pointer)return;
 e.preventDefault();
 const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
 drag.travel+=Math.hypot(e.clientX-drag.lastX,e.clientY-drag.lastY)/165;
 drag.lastX=e.clientX;drag.lastY=e.clientY;
 drag.params=sampleGesture({originX:drag.x,dx,dy,travel:drag.travel,
   elapsed:performance.now()-drag.started});
 gesture=drag.params;
 if(Math.abs(dx)+Math.abs(dy)>8)drag.moved=true;
 $('tension').textContent=String(Math.round(drag.params.tension*100)).padStart(2,'0');
 $('gestureHint').textContent=drag.params.ny>.12?'You are lifting the phrase.':
   drag.params.ny<-.12?'The phrase is settling lower.':
   drag.params.nx>.13?'You are stretching the phrase.':
   drag.params.nx<-.13?'You are pulling it closer.':'Find the tension.';
 const ms=performance.now();
 if(drag.moved&&ms-lastMoveAt>32){lastMoveAt=ms;previewFinger()}
}
function finish(e,canceled=false){
 if(!drag||e.pointerId!==pointer)return;
 if(!canceled)move(e);
 const d=drag;
 drag=null;gesture=null;pointer=null;
 canvas.classList.remove('is-held');stage.classList.remove('is-held');
 try{canvas.releasePointerCapture(e.pointerId)}catch{}
 audio.releaseSculpt();
 $('tension').textContent='00';$('gestureName').textContent='READY TO RESPOND';
 const enough=d.moved&&d.params.tension>.065;
 if(canceled){status('Gesture canceled. Your music is unchanged.');return}
 if(!enough){
   $('gestureHint').textContent='Press, pull farther, release.';
   if(ready)audio.previewChange(program(),d.anchor);
   return;
 }
 const before=history.current;
 const after=applyGesture(before,d.params,d.anchor);
 if(!history.commit(after))return;
 compareOriginal=false;lastBefore=before;lastAnchor=d.anchor;
 updateChanges(before,after,d.anchor);
 recordMemory({...d.params,anchor:d.anchor},after);
 enqueue();updatePlayer();
 $('gestureHint').textContent='Your movement changed the groove.';
 $('responseText').textContent='Release becomes music. The other instruments respond to the physical direction and energy of your pull.';
 audio.previewChange(compilePhysical(after),d.anchor);
 status(playing?'Heard the release. The full arrangement joins on the next loop.':
   'A new musical idea. Press Hear the Groove to hear it together.');
 pulse=1;
}
canvas.addEventListener('pointerdown',begin);
canvas.addEventListener('pointermove',move);
canvas.addEventListener('pointerup',e=>finish(e,false));
canvas.addEventListener('pointercancel',e=>finish(e,true));
canvas.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId)finish(e,true)});
canvas.addEventListener('keydown',e=>{
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(e.key))return;
 e.preventDefault();
 const up=e.key==='ArrowUp',down=e.key==='ArrowDown',left=e.key==='ArrowLeft',right=e.key==='ArrowRight';
 const dx=left?-60:right?60:0,dy=up?-60:down?60:e.key==='Enter'?-52:0;
 const g=sampleGesture({originX:.50,dx,dy,elapsed:320,travel:Math.hypot(dx,dy)/155});
 const anchor=chooseAnchor(history.current,g.originX),before=history.current;
 const after=applyGesture(before,g,anchor);
 if(history.commit(after)){
   compareOriginal=false;lastBefore=before;lastAnchor=anchor;
   updateChanges(before,after,anchor);recordMemory({...g,anchor},after);
   enqueue();updatePlayer();audio.previewChange(compilePhysical(after),anchor);pulse=1;
   status('A keyboard gesture changed your musical form.');
 }
});
$('play').addEventListener('click',async()=>{
 if(busy)return;
 if(playing){audio.stop();status('The music paused. Your gestures are still here.');return}
 busy=true;updatePlayer();$('play').disabled=true;
 try{
   await audio.resume(program());ready=true;
   $('gestureHint').textContent='Press, pull and release the form.';
   status('The music is moving. Touch the form and change its relationships.');
 }catch(e){status(e.message||'Sound unavailable.')}
 finally{busy=false;$('play').disabled=false;updatePlayer();updateComparisonLabel()}
});
$('undo').addEventListener('click',()=>{
 const before=history.current;
 if(!history.undo())return;
 compareOriginal=false;lastBefore=before;lastAnchor=chooseAnchor(history.current,.5);
 enqueue();updateChanges(before,history.current,lastAnchor);updatePlayer();persist();
 status('Previous gesture restored. Nothing lost.');
});
$('reset').addEventListener('click',()=>{
 audio.releaseSculpt();
 history.current=structuredClone(history.original);
 history.undoStack=[];history.redoStack=[];
 compareOriginal=false;lastBefore=history.original;lastAnchor='b4';
 memory=[];snapshots=[];renderMemory();enqueue();updatePlayer();syncButtons();persist();
 $('responseTitle').textContent='The original, ready to be changed.';
 $('responseText').textContent='You can always start again.';
 $('bassResponse').textContent='THE FOUNDATION';$('harmonyResponse').textContent='LISTENING';$('rhythmResponse').textContent='KEEPING TIME';
 $('gestureHint').textContent='Hold anywhere, then pull.';
 status('Original reset. A fresh musical form is ready.');
});
function setComparison(original){
 if(compareOriginal===original)return;
 compareOriginal=original;enqueue();updatePlayer();
 $('queued').textContent='NEXT LOOP / '+(original?'ORIGINAL':'YOUR VERSION');
 status(playing?'The '+(original?'original':'variation')+' arrives at the next loop boundary.':
   'Press play to hear the '+(original?'original':'variation')+'.');
}
$('original').addEventListener('click',()=>setComparison(true));
$('yours').addEventListener('click',()=>setComparison(false));
$('beforeAfter').addEventListener('click',()=>{
 if(!ready){status('Press Hear the Groove first to enable this comparison.');return}
 const ok=audio.compareChange(compilePhysical(lastBefore),compilePhysical(history.current),lastAnchor);
 if(!ok)return;
 $('beforeAfter').textContent='♫ ORIGINAL → CHANGE';
 status('Two moments: the original bass and harmony, then your response.');
 setTimeout(()=>{$('beforeAfter').textContent='▶  BEFORE / AFTER'},1600);
});
function renderSave(){
 $('saved').replaceChildren();
 history.variants.forEach(v=>{
   const btn=document.createElement('button');btn.type='button';
   btn.textContent='VERSION '+v.id;
   btn.addEventListener('click',()=>{
     const before=history.current;
     const next={...structuredClone(v.frame),revision:before.revision+1,parentRevision:before.revision};
     if(!history.commit(next))return;
     compareOriginal=false;lastBefore=before;lastAnchor=chooseAnchor(next,.5);
     enqueue();updatePlayer();persist();
     status('Version '+v.id+' restored. You can keep exploring.');
   });
   $('saved').appendChild(btn);
 });
}
$('save').addEventListener('click',()=>{
 const v=history.save();renderSave();
 try{localStorage.setItem('offbeat.form.gesture.saved.v1',JSON.stringify(history.variants))}catch{}
 status('Kept version '+v.id+' on this device.');
});
$('export').addEventListener('click',async()=>{
 const button=$('export');button.disabled=true;button.textContent='RENDERING…';
 try{
   const wave=await audio.exportWav(program());
   downloadBlob(wave,'FORM-009-'+(compareOriginal?'ORIGINAL':'GESTURE')+'.wav');
   status('Saved your musical form as a WAV.');
 }catch(e){status('Export unavailable: '+(e.message||'Unknown error'))}
 finally{button.disabled=false;button.textContent='↓ EXPORT WAV'}
});
for(const [key,id] of [['pulse','keepPulse'],['harmony','keepHarmony'],['feel','keepFeel']]){
 $(id).addEventListener('change',()=>{
   const before=history.current,next=setConstraint(before,key,$(id).checked);
   if(history.commit(next)){
     compareOriginal=false;lastBefore=before;lastAnchor=chooseAnchor(next,.5);
     enqueue();updateChanges(before,next,lastAnchor);updatePlayer();persist();
     status('Musical relationship updated. The original gestures are intact.');
   }
 });
}
function restore(){
 try{
   const parsed=JSON.parse(localStorage.getItem('offbeat.form.gesture.v1')||'null');
   if(parsed?.schema==='offbeat.form.gesture.v1'&&validate(parsed.frame)){
     history.current=parsed.frame;
     memory=Array.isArray(parsed.memory)?parsed.memory.filter(x=>x&&validate(x.frame)).slice(-16):[];
     snapshots=Array.isArray(parsed.snapshots)?parsed.snapshots.filter(x=>x&&validate(x.frame)).slice(-12):[];
     $('responseTitle').textContent='Your movement is still here.';
     $('responseText').textContent='The last shape was restored on this device. Pull it somewhere new.';
   }
 }catch{}
 try{
   const saved=JSON.parse(localStorage.getItem('offbeat.form.gesture.saved.v1')||'[]');
   if(Array.isArray(saved)){
     history.variants=saved.filter(x=>x&&validate(x.frame)).slice(-4);
     history.variantCounter=Math.max(0,...history.variants.map(x=>/^[A-Z]$/.test(x.id)?x.id.charCodeAt(0)-64:0));
   }
 }catch{}
 $('beforeAfter').disabled=history.current.revision===0;
 for(const [key,id] of [['pulse','keepPulse'],['harmony','keepHarmony'],['feel','keepFeel']]){
   $(id).checked=history.current.constraints[key];
 }
 renderMemory();renderSave();updatePlayer();updateComparisonLabel();
}
function syncButtons(){
 $('beforeAfter').disabled=history.current.revision===0;
 ['pulse','harmony','feel'].forEach(key=>{
   const id='keep'+key[0].toUpperCase()+key.slice(1);
   $(id).checked=history.current.constraints[key];
 });
}
const originalCommit=history.commit.bind(history);
history.commit=next=>{const result=originalCommit(next);if(result)syncButtons();return result};

// PHYSICAL RENDERER — motion-driven parametric 2.5D ribbon.
// Shading comes from geometry, curvature and illumination; no animation is
// merely a waveform of output volume. The material expresses authored phrase.
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W=0,H=0,dpr=1,tickAt=performance.now();
function resize(){
 const box=canvas.getBoundingClientRect();
 W=Math.max(230,box.width);H=Math.max(220,box.height);
 dpr=Math.min(2,Math.max(1,devicePixelRatio||1));
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
 brush.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',resize);
function phraseAt(t,notes){
 const count=notes.length,beat=t*8;
 const arr=notes.slice().sort((a,b)=>a.beat-b.beat);
 let i=0;while(i<count-2&&arr[i+1].beat<beat)i++;
 const a=arr[i],b=arr[Math.min(i+1,count-1)],span=Math.max(.001,b.beat-a.beat);
 const u=clamp((beat-a.beat)/span,0,1),smooth=u*u*(3-2*u);
 return a.height*(1-smooth)+b.height*smooth;
}
function pointOnRibbon(t,frame,ct=0){
 const x=W*(.085+.83*t),section=frame.notes;
 const phrase=phraseAt(t,section);
 const movement=spring;
 const pivot=gesture?.originX||.50;
 const taper=Math.exp(-Math.pow((t-pivot)/.18,2));
 const y=H*(.52-(phrase-.45)*.23)+
    Math.sin(t*15+frameCount*.012)*H*.014+
    Math.sin(t*37-frameCount*.009)*H*.005+
    movement.y*H*.17*taper+
    Math.sin(t*6.8+frameCount*.005)*Math.abs(movement.x)*H*.012;
 return {x:x+movement.x*W*.12*taper,y};
}
function strokeCurved(points,color,width,alpha=1){
 if(points.length<2)return;
 brush.beginPath();brush.moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++)brush.lineTo(points[i].x,points[i].y);
 brush.strokeStyle=color;brush.globalAlpha=alpha;brush.lineWidth=width;
 brush.lineCap='round';brush.lineJoin='round';brush.stroke();brush.globalAlpha=1;
}
function drawFrame(){
 if(!W||!H)return;
 const frame=activeFrame(),hold=!!drag;
 brush.clearRect(0,0,W,H);
 const scale=H/440;
 const heldTension=drag?.params.tension||0;
 const center=Array.from({length:138},(_,i)=>pointOnRibbon(i/137,frame));
 const centerY=center.reduce((a,p)=>a+p.y,0)/center.length;
 // Soft ambient field, separated into quiet layers.
 for(let k=0;k<9;k++){
   const offset=(k-4)*18*scale;
   const field=center.map((p,i)=>({x:p.x,y:p.y+offset+
     Math.sin(i*.071+k*.82+frameCount*.006)*(5+k)*scale}));
   strokeCurved(field,k%2?'#b18c78':'#e2b49a',.5+(k%3)*.24,.028+(k%3)*.018);
 }
 // The material is a ribbon mesh, with top/bottom folds and a specular edge.
 const above=[],below=[],highlight=[],ridge=[];
 const wrap=hold?heldTension:Math.max(0,Math.hypot(spring.x,spring.y)*.22);
 for(let i=0;i<center.length;i++){
   const t=i/(center.length-1);
   const envelope=Math.pow(Math.max(0,1-Math.pow(t*2-1,2)),.48);
   const twist=.45+.55*Math.cos(t*10.3+spring.x*2.1+frameCount*.005);
   const half=(9.5+twist*18+wrap*11)*scale*envelope;
   const depth=Math.sin(t*13.4+frameCount*.008+spring.x*1.5)*12*scale*envelope;
   above.push({x:center[i].x,y:center[i].y-half+depth*.12});
   below.push({x:center[i].x,y:center[i].y+half+depth*.6});
   highlight.push({x:center[i].x,y:center[i].y-half*.71+depth*.14});
   ridge.push({x:center[i].x,y:center[i].y+half*.16+depth*.2});
 }
 const bodyGrad=brush.createLinearGradient(0,centerY-75*scale,0,centerY+75*scale);
 bodyGrad.addColorStop(0,'#edc5a6');bodyGrad.addColorStop(.26,'#cc8c69');
 bodyGrad.addColorStop(.55,'#aa6549');bodyGrad.addColorStop(.76,'#6f3e30');
 bodyGrad.addColorStop(1,'#dc9975');
 brush.beginPath();brush.moveTo(above[0].x,above[0].y);
 above.forEach((p,i)=>{if(i)brush.lineTo(p.x,p.y)});
 below.slice().reverse().forEach(p=>brush.lineTo(p.x,p.y));
 brush.closePath();brush.fillStyle=bodyGrad;brush.shadowBlur=28+wrap*45;
 brush.shadowColor='rgba(214,130,85,.23)';brush.fill();brush.shadowBlur=0;
 // Depth lines have varying brightness; quiet, gallery-like surface, not HUD.
 strokeCurved(highlight,'#f4caa9',1.65*scale,.51+wrap*.2);
 strokeCurved(ridge,'#ac735d',1.4*scale,.64);
 strokeCurved(above,'#f0d0b6',.7*scale,.56);
 strokeCurved(below,'#4e2d25',1.4*scale,.58);
 // The secondary audio layers are physically tethered to the form.
 const harmonics=center.map((p,i)=>({x:p.x,y:p.y+H*.115+Math.sin(i*.09+frameCount*.01)*H*.009}));
 const rhythm=center.map((p,i)=>({x:p.x,y:p.y+H*.18+Math.sin(i*.17+frameCount*.019)*H*.005}));
 strokeCurved(harmonics,'#cebba8',1.1*scale,.28+wrap*.3);
 strokeCurved(rhythm,'#a0a28a',.9*scale,.27+wrap*.25);
 for(const evt of compilePhysical(frame).physicalResponses){
   const t=evt.beat/8,c=pointOnRibbon(t,frame);
   brush.beginPath();brush.arc(c.x,c.y+H*.18,2.4+evt.velocity*7,0,Math.PI*2);
   brush.fillStyle='rgba(195,207,174,.82)';brush.fill();
 }
 // Original remains a subtle underdrawing after the user starts changing it.
 if(frame.revision!==0&&!compareOriginal){
   const ghosts=Array.from({length:85},(_,i)=>pointOnRibbon(i/84,history.original));
   strokeCurved(ghosts,'#d6b29b',1.05*scale,.20);
 }
 // Persistent geometry traces from real gesture input—not meaningless particles.
 for(let i=0;i<memory.length;i++){
   const item=memory[i],g=item.gesture;
   if(!g)continue;
   const origin=pointOnRibbon(g.originX,frame),nx=g.nx,ny=g.ny;
   const fade=(i+1)/memory.length;
   const end={x:origin.x+nx*W*.13,y:origin.y-ny*H*.15};
   const mid={x:(origin.x+end.x)/2+ny*24*scale,y:(origin.y+end.y)/2+nx*15*scale};
   brush.beginPath();brush.moveTo(origin.x,origin.y);
   brush.quadraticCurveTo(mid.x,mid.y,end.x,end.y);
   brush.strokeStyle='rgba(230,175,132,'+(.15+fade*.32).toFixed(3)+')';
   brush.lineWidth=(.65+fade*1.1)*scale;brush.stroke();
   brush.beginPath();brush.arc(end.x,end.y,Math.max(1.5,2.7*scale),0,Math.PI*2);
   brush.fillStyle='rgba(239,193,153,'+(.2+fade*.5).toFixed(3)+')';brush.fill();
 }
 if(hold&&gesture){
   const origin=pointOnRibbon(gesture.originX,frame);
   const end={x:origin.x+gesture.nx*W*.14,y:origin.y-gesture.ny*H*.19};
   brush.beginPath();brush.moveTo(origin.x,origin.y);
   brush.quadraticCurveTo((origin.x+end.x)/2+gesture.ny*28,(origin.y+end.y)/2,end.x,end.y);
   brush.strokeStyle='rgba(248,200,164,.68)';brush.lineWidth=1.5;brush.stroke();
   brush.beginPath();brush.arc(end.x,end.y,13+gesture.tension*10,0,Math.PI*2);
   brush.strokeStyle='rgba(237,171,132,.37)';brush.lineWidth=1;brush.stroke();
   brush.beginPath();brush.arc(end.x,end.y,3.2,0,Math.PI*2);
   brush.fillStyle='#f6d8bb';brush.fill();
 }else if(pulse>.01){
   const origin=pointOnRibbon(memory.at(-1)?.gesture.originX||.5,frame);
   brush.beginPath();brush.arc(origin.x,origin.y,14+(1-pulse)*50,0,Math.PI*2);
   brush.strokeStyle='rgba(226,156,111,'+(pulse*.27).toFixed(3)+')';
   brush.lineWidth=1.4;brush.stroke();
 }
 // A restrained loop cursor ties the material to musical time.
 if(playing){
   const p=pointOnRibbon(progress,frame);
   brush.beginPath();brush.arc(p.x,p.y,3,0,Math.PI*2);
   brush.fillStyle='#f5dfcc';brush.shadowBlur=14;brush.shadowColor='#ffb889';
   brush.fill();brush.shadowBlur=0;
 }
}
function tick(time){
 let dt=Math.min(.05,Math.max(.001,(time-tickAt)/1000));tickAt=time;
 const target=gesture?{held:true,x:gesture.nx,y:-gesture.ny}:{held:false,x:0,y:0};
 spring=reduced?{x:target.x,y:target.y,vx:0,vy:0}:physicsStep(spring,target,dt);
 if(!reduced)frameCount++;
 pulse*=reduced?.5:.956;
 drawFrame();
 requestAnimationFrame(tick);
}
restore();
resize();requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>audio.dispose());
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&playing){audio.stop();status('Paused while away. Your form stays here.')}
});
