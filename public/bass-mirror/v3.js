/* OFFBEAT / BASS MIRROR 003 — musical memory, not decorative particles.
   Operates only on the 16-step pattern built from the user's extracted samples.
   No claims of AI recognition/transcription from original long recordings. */
(()=>{
'use strict';
const el=id=>document.getElementById(id);
if(!el('scope')||!el('sequence')||!el('play'))return;
document.body.classList.add('bm-v3');
const ids=SAMPLE_INFO.map(item=>item[0]);
const bassIds=ids.slice(0,6);
const labels=Object.fromEntries(SAMPLE_INFO.map(item=>[item[0],item[1]]));
const copy=obj=>JSON.parse(JSON.stringify(obj));
const wrap=document.querySelector('.bm-lab');
const modes=wrap&&wrap.querySelector('.bm-modes');
const canvas=el('scope');
let view='memory',proposal=null,original=null,candidate=null,proposalCount=0,memo=[],selectedCell=null,lastSignature='',renderGuard=false;
const STORAGE_KEY='offbeat.bassmirror.saved.v3';
const algo={echo:'ECHO A GESTURE',answer:'WRITE AN ANSWER',space:'MAKE SPACE',shift:'SHIFT THE TIMING'};
const readableStep=i=>String(i+1).padStart(2,'0');
const safeGet=()=>{try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(x)?x.slice(0,12).filter(y=>y&&y.pattern):[]}catch{return []}};
const safePut=x=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(x.slice(0,12)));return true}catch{return false}};
memo=safeGet();
if(modes){
 const m=modes.querySelector('[data-vis="memory"]');
 if(m){modes.insertBefore(m,modes.firstChild)}
 modes.querySelectorAll('[data-vis]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.vis;updateViewCopy()},false));
}
const below=document.querySelector('.bm-below');
if(below){below.insertAdjacentHTML('afterend','<p class="bm-meaning">Each row is one sound from your sessions. Left → right is time. A filled mark plays; an outlined mark shows a suggested change. Tap a filled mark to hear it.</p>')}

const inspect=document.createElement('section');
inspect.className='bm-inspector';
inspect.setAttribute('aria-label','Pattern memory explanation');
inspect.innerHTML=
'<div class="bmi-head"><div><span class="bmi-eyebrow">PATTERN MEMORY / 16 POSITIONS</span><h2>Find what comes back.</h2></div><span class="bmi-chip" id="bmiState">LISTENING TO THE GRID</span></div>'+
'<div class="bmi-report"><div class="bmi-finding"><span class="bmi-overline">REPEATED GESTURE</span><strong id="bmiFinding">Reading your pattern…</strong><p id="bmiExplain"></p></div><div class="bmi-stats"><div><small>REPEAT SIMILARITY</small><strong id="bmiRepeat">—</strong></div><div><small>ACTIVE BASS HITS</small><strong id="bmiHits">—</strong></div><div><small>STRONGEST ANCHOR</small><strong id="bmiAnchor">—</strong></div></div></div>'+
'<p class="bmi-proof">The scan compares repeated four-step gestures in this sequencer. It is not detecting pitch or motifs directly from your full original recordings—yet.</p>';
if(wrap)wrap.insertAdjacentElement('afterend',inspect);
const actions=document.createElement('div');actions.className='bmi-actions';actions.innerHTML='<button id="bmiCreate">TRY A MUSICAL VARIATION <span aria-hidden="true">↗</span></button><button id="bmiEdit">EDIT THE 16 STEPS ↓</button>';const proof=inspect.querySelector('.bmi-proof');if(proof)proof.insertAdjacentElement('beforebegin',actions);
const pane=Array.from(document.querySelectorAll('.pane')).find(n=>n.textContent.includes('DECISION ENGINE'));
if(!pane)return;
pane.classList.add('bm-decision-pane');
const presetDesc=el('presetDesc');
if(presetDesc)presetDesc.insertAdjacentHTML('afterend',
'<div class="bm-engine" id="bmEngine">'+
'<div class="bm-engine-header"><span>02 / INTENTIONAL VARIATION</span><strong>Choose what survives.</strong></div>'+
'<div class="bm-engine-selectors"><label>PROTECT THIS SOUND<select id="bmProtect"><option value="low">LOW</option><option value="pulse">PULSE</option><option value="rise">RISE</option><option value="spark">SPARK</option><option value="other">OTHER</option><option value="shift">SHIFT</option><option value="none">NOTHING</option></select></label>'+
'<label>CHANGE ONE THING<select id="bmAction"><option value="answer">Write an answer</option><option value="echo">Echo a gesture</option><option value="space">Make space</option><option value="shift">Shift the timing</option></select></label></div>'+
'<button class="bm-action-button" id="bmSuggest">TRY A VARIATION <span aria-hidden="true">↗</span></button>'+
'<div class="bm-proposal" id="bmProposal" hidden><div class="bm-proposal-kicker">PROPOSED CHANGE <span id="bmChangeNumber"></span></div><strong id="bmDiffTitle"></strong><p id="bmDiffDescription"></p><div class="bm-ab" role="group" aria-label="Audition change"><button id="bmBefore">A · BEFORE</button><button id="bmAfter">B · AFTER</button></div><div class="bm-commit"><button id="bmKeep">KEEP CHANGE</button><button id="bmCancel">DISCARD</button></div></div>'+
'</div>'+
'<div class="bm-vault"><div class="bm-vault-title"><strong>IDEA VAULT</strong><span>ON THIS DEVICE</span></div><div class="bm-vault-save"><input id="bmIdeaName" aria-label="Name your pattern" maxlength="40" placeholder="Name this groove…"><button id="bmSave">KEEP THIS VERSION</button></div><div id="bmSaved" class="bm-saved"></div><p>Stored only in this browser. Export WAV to keep the audio itself.</p></div>');
const legacyMutate=el('mutate');
if(legacyMutate){
 legacyMutate.textContent='✳ TRY A CHANGE';
 legacyMutate.onclick=()=>{makeProposal();el('bmEngine')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});};
}
const fitPattern=p=>ids.every(id=>Array.isArray(p?.[id])) && Object.values(p).every(v=>Array.isArray(v)) &&
 ids.every(id=>p[id].every(x=>Number.isInteger(x)&&x>=0&&x<16));
function snapshot(){return {pattern:copy(pattern),tempo:Number(el('tempo').value),swing:Number(el('swing').value),ghost:Number(el('ghost').value)}}
function loadSnapshot(s){
 if(!s||!fitPattern(s.pattern))return;
 pattern=copy(s.pattern);
 if(Number.isFinite(s.tempo))el('tempo').value=String(Math.min(145,Math.max(65,s.tempo)));
 if(Number.isFinite(s.swing))el('swing').value=String(Math.min(60,Math.max(0,s.swing)));
 if(Number.isFinite(s.ghost))el('ghost').value=String(Math.min(70,Math.max(0,s.ghost)));
 changed=[];updateControls();render();
}
function patternSignature(p){return ids.map(id=>id+':'+(p[id]||[]).slice().sort((a,b)=>a-b).join(',')).join('|')}
function scan(p){
 const bassCount=bassIds.reduce((acc,id)=>acc+(p[id]||[]).length,0);
 const most=bassIds.map(id=>({id,count:p[id].length})).sort((a,b)=>b.count-a.count||bassIds.indexOf(a.id)-bassIds.indexOf(b.id))[0];
 const pairs=[];
 for(const start of [0,4]){
  const a=[],b=[];
  for(const id of bassIds)for(let d=0;d<4;d++){
   if(p[id].includes(start+d))a.push(id+':'+d);
   if(p[id].includes(start+8+d))b.push(id+':'+d);
  }
  const common=a.filter(x=>b.includes(x)),union=new Set([...a,...b]).size;
  pairs.push({start,common,sim:union?common.length/union:0,comparisons:[a.length,b.length]});
 }
 pairs.sort((a,b)=>b.common.length-a.common.length||b.sim-a.sim);
 return {bassCount,most,best:pairs[0],pairScores:pairs,hasRepeat:pairs[0].common.length>0};
}
function showScan(){
 const result=scan(pattern),match=result.best,shared=Array.from(new Set(match.common.map(x=>x.split(':')[0]))).map(id=>labels[id]);
 const pct=Math.round(match.sim*100);
 el('bmiState').textContent=playing?'LIVE / LOOP '+String(Math.floor(stepCount/16)+1).padStart(2,'0'):'READY / PATTERN MAP';
 el('bmiRepeat').textContent=match.hasRepeat?pct+'%':'—';
 el('bmiHits').textContent=String(result.bassCount).padStart(2,'0');
 el('bmiAnchor').textContent=result.most.count?labels[result.most.id]:'—';
 if(match.hasRepeat){
  el('bmiFinding').textContent=shared.join(' + ')+' comes back.';
  el('bmiExplain').textContent=match.common.length+' matched bass placements across steps '+readableStep(match.start)+'–'+readableStep(match.start+3)+' and '+readableStep(match.start+8)+'–'+readableStep(match.start+11)+'. Similarity compares active positions, not pitches.';
 } else {
  el('bmiFinding').textContent='No matching four-step bass gesture yet.';
  el('bmiExplain').textContent='Try Echo a gesture in the decision engine, or edit the grid below to create a repeated shape.';
 }
 return result;
}
function updateViewCopy(){
 const headings={memory:'01 / YOUR MUSICAL MEMORY',form:'01 / SOUND BECOMES FORM',spectrum:'01 / LIVE FREQUENCY'};
 const header=document.querySelector('.bm-bar>span');if(header)header.textContent=headings[view]||headings.memory;
 const guide=document.querySelector('.bm-meaning');if(guide)guide.hidden=view!=='memory';
 if(view==='memory')el('bmDescriptor').textContent='READ THE GRID · TAP A FILLED NOTE';
 showScan();
}
function pickChange(p,id,from,to,type){
 if(type==='add'){if(p[id].includes(to))return null;p[id].push(to);return [{id,i:to,type:'added'}]}
 if(type==='remove'){if(!p[id].includes(from))return null;p[id]=p[id].filter(i=>i!==from);return [{id,i:from,type:'removed'}]}
 if(type==='move'){
  if(from===to||!p[id].includes(from)||p[id].includes(to))return null;
  p[id]=p[id].filter(i=>i!==from);p[id].push(to);return [{id,i:from,type:'removed'},{id,i:to,type:'added'}];
 }
 return null;
}
function makeProposal(){
 const base=snapshot(),out=copy(base),protectedId=el('bmProtect').value,kind=el('bmAction').value;
 const candidates=bassIds.filter(x=>x!==protectedId);
 let diffs=null,explanation='',heading='';
 const act=(fn)=>{
  if(diffs)return;
  const res=fn();if(res&&res.length)diffs=res;
 };
 if(kind==='answer'){
  const order=['spark','rise','other','shift','pulse','low'].filter(id=>candidates.includes(id));
  for(const id of order){
   const slots=[12,14,13,15,10,11,9,8];
   for(const step of slots){
    const noBass=bassIds.every(r=>!out.pattern[r].includes(step));
    if(noBass){act(()=>pickChange(out.pattern,id,null,step,'add'));if(diffs){heading='A new answer appears.';explanation=labels[id]+' enters at step '+readableStep(step)+', leaving your protected sound unchanged.';break}}
   }
   if(diffs)break;
  }
 } else if(kind==='echo'){
  const best=scan(out.pattern).best;
  const regions=[best.start,best.start===0?4:0,0,4];
  for(const start of regions){
   for(const id of candidates){
    for(let d=0;d<4;d++){
     const source=start+d,target=start+8+d;
     if(out.pattern[id].includes(source)&&!out.pattern[id].includes(target)){
      act(()=>pickChange(out.pattern,id,null,target,'add'));
      if(diffs){heading='That gesture returns.';explanation=labels[id]+' at step '+readableStep(source)+' is echoed at step '+readableStep(target)+'. The first hit stays intact.';break}
     }
    }
    if(diffs)break;
   }
   if(diffs)break;
  }
 } else if(kind==='space'){
  const sorted=candidates.slice().sort((a,b)=>out.pattern[b].length-out.pattern[a].length);
  for(const id of sorted){
   if(out.pattern[id].length<2)continue;
   const from=out.pattern[id].slice().sort((a,b)=>b-a)[0];
   act(()=>pickChange(out.pattern,id,from,null,'remove'));
   if(diffs){heading='A little breathing room.';explanation=labels[id]+' leaves step '+readableStep(from)+', creating silence without disturbing '+(protectedId==='none'?'the remaining pattern':labels[protectedId])+'.';break}
  }
 } else if(kind==='shift'){
  for(const id of candidates){
   for(const from of out.pattern[id].slice().sort((a,b)=>a-b)){
    for(const movement of [1,-1,2,-2]){
     const to=from+movement;
     if(to<0||to>15||Math.floor(to/4)!==Math.floor(from/4))continue;
     act(()=>pickChange(out.pattern,id,from,to,'move'));
     if(diffs){heading='Same note. Different timing.';explanation=labels[id]+' shifts from step '+readableStep(from)+' to '+readableStep(to)+'. The four-step phrase stays in place.';break}
    }
    if(diffs)break;
   }
   if(diffs)break;
  }
 }
 if(!diffs){
  proposal=null;original=null;candidate=null;changed=[];render();
  el('bmDiffTitle').textContent='Nothing to change in this direction.';
  el('bmDiffDescription').textContent='Your protected sound and the available positions leave no meaningful single change. Choose another direction.';
  el('bmProposal').hidden=false;
  el('bmBefore').disabled=true;el('bmAfter').disabled=true;el('bmKeep').disabled=true;el('bmCancel').disabled=false;
  return;
 }
 proposal={base,out,diffs,heading,explanation,kind,protectedId};
 original=copy(base);candidate=copy(out);proposalCount++;
 el('bmDiffTitle').textContent=heading;
 el('bmDiffDescription').textContent=explanation;
 el('bmChangeNumber').textContent='#'+String(proposalCount).padStart(2,'0');
 el('bmBefore').disabled=false;el('bmAfter').disabled=false;el('bmKeep').disabled=false;
 el('bmProposal').hidden=false;loadSnapshot(candidate);setDiffs(diffs);setVariant('after');
 setStatus('Variation proposed. Hear A / B. Keep or discard it.');
}
function setDiffs(diffs){
 changed=diffs.map(d=>({id:d.id,i:d.i}));
 render();
}
function setVariant(which){
 if(!proposal)return;
 const snap=which==='before'?original:candidate;
 loadSnapshot(snap);setDiffs(proposal.diffs);
 for(const [k,id] of [['before','bmBefore'],['after','bmAfter']])el(id).classList.toggle('is-active',which===k);
 el('bmDiffDescription').textContent=proposal.explanation+'  ·  Listening to '+(which==='before'?'A / original':'B / variation')+'.';
 if(!playing)void play();
}
function clearProposal(restore=false){
 if(restore&&original)loadSnapshot(original);
 proposal=null;original=null;candidate=null;el('bmProposal').hidden=true;changed=[];render();showScan();
}
el('bmSuggest').onclick=makeProposal;
el('bmiCreate').onclick=()=>legacyMutate?.click();
el('bmiEdit').onclick=()=>el('sequence')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
el('bmBefore').onclick=()=>setVariant('before');
el('bmAfter').onclick=()=>setVariant('after');
el('bmCancel').onclick=()=>{clearProposal(true);setStatus('Discarded the variation. Your original pattern is back.')};
el('bmKeep').onclick=()=>{
 if(!proposal)return;loadSnapshot(candidate);baseline=copy(pattern);clearProposal(false);setStatus('Kept that change. This is your new starting point.');
};
function showVault(){
 const dest=el('bmSaved');dest.replaceChildren();
 if(!memo.length){const e=document.createElement('p');e.className='bm-empty';e.textContent='No saved versions yet. Keep one before you explore.';dest.appendChild(e);return}
 memo.slice(0,6).forEach((item,i)=>{
  const row=document.createElement('div');row.className='bm-vault-item';
  const title=document.createElement('span');title.textContent=item.title;
  const load=document.createElement('button');load.textContent='OPEN';load.setAttribute('aria-label','Open '+item.title);
  load.onclick=()=>{clearProposal();loadSnapshot(item.snapshot);baseline=copy(pattern);setStatus('Opened '+item.title+'. The audio is ready to play.')};
  const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Delete '+item.title);
  remove.onclick=()=>{memo=memo.filter(x=>x.id!==item.id);safePut(memo);showVault()};
  row.append(title,load,remove);dest.appendChild(row);
 });
}
el('bmSave').onclick=()=>{
 const text=el('bmIdeaName').value.trim()||'Groove '+String(memo.length+1).padStart(2,'0');
 const item={id:Date.now()+'-'+String(memo.length),title:text,snapshot:snapshot()};
 memo.unshift(item);
 if(safePut(memo)){el('bmIdeaName').value='';showVault();setStatus('Saved '+text+' to this browser.')}else setStatus('Storage unavailable. Use Export 8-bar WAV to keep the audio.');
};
showVault();
const oldRender=render;
render=function(){oldRender();showScan()};
const oldReset=reset;
reset=function(p='RECALL'){clearProposal(false);oldReset(p);showScan()};
const oldDraw=draw;
let memoryScene=null;
function drawMemory(){
 const ctx=canvas.getContext('2d'),dpr=Math.min(window.devicePixelRatio||1,2);
 const width=Math.max(1,Math.round(canvas.clientWidth*dpr)),height=Math.max(1,Math.round(canvas.clientHeight*dpr));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
 ctx.fillStyle='#17120f';ctx.fillRect(0,0,width,height);
 const left=72*dpr,right=15*dpr,top=54*dpr,bottom=22*dpr;
 const plotW=Math.max(20,width-left-right),plotH=Math.max(20,height-top-bottom),rowH=plotH/9,colW=plotW/16;
 const live=playing?Math.max(0,(stepCount-1)%16):-1;
 const result=scan(pattern),highlight=result.hasRepeat?result.best.start:-1;
 ctx.font='600 '+(9*dpr)+'px system-ui';
 ctx.textAlign='center';
 for(let i=0;i<16;i++){
  const x=left+i*colW;
  if(i%4===0){
   ctx.fillStyle='#aa8f7a';ctx.fillText(String(i+1).padStart(2,'0'),x+colW/2,top-13*dpr);
  }
  ctx.fillStyle=i%4===0?'rgba(191,146,115,.27)':'rgba(191,146,115,.085)';
  ctx.fillRect(x,top,i%4===0?1.4*dpr:1*dpr,plotH);
 }
 ctx.fillStyle='rgba(191,146,115,.27)';ctx.fillRect(left+plotW,top,dpr,plotH);
 if(highlight>=0){
  for(const start of [highlight,highlight+8]){
   ctx.fillStyle='rgba(199,122,83,.10)';ctx.fillRect(left+start*colW,top,4*colW,6*rowH);
   ctx.strokeStyle='rgba(224,154,112,.48)';ctx.lineWidth=.9*dpr;ctx.strokeRect(left+start*colW+1*dpr,top+1*dpr,4*colW-2*dpr,6*rowH-2*dpr);
  }
 }
 if(live>=0){
  ctx.fillStyle='rgba(237,178,128,.09)';
  ctx.fillRect(left+live*colW,top,colW,plotH);
  ctx.fillStyle='#eeb587';ctx.fillRect(left+live*colW,top-1*dpr,Math.max(2,dpr),plotH+2*dpr);
 }
 for(let i=0;i<9;i++){
  const y=top+i*rowH;ctx.fillStyle=i<6?'rgba(186,147,119,.11)':'rgba(132,127,119,.14)';ctx.fillRect(0,y,width,rowH-1*dpr);
  if(i===6){ctx.fillStyle='#987d6b';ctx.fillRect(0,y-3*dpr,width,1*dpr)}
  ctx.font=(i<6?'600 ':'500 ')+(10*dpr)+'px system-ui';ctx.textAlign='left';
  ctx.fillStyle=i<6?'#d8c2b0':'#958a7e';ctx.fillText(labels[ids[i]],10*dpr,y+rowH*.63);
  const p=pattern[ids[i]]||[];
  for(const step of p){
   const x=left+step*colW+colW*.5,cy=y+rowH*.5;
   const isChanged=(changed||[]).some(o=>o.id===ids[i]&&o.i===step);
   if(i<6){
    ctx.fillStyle=isChanged?'#f0d7a5':'#d68c63';
    const rw=Math.min(colW*.70,12*dpr),rh=Math.min(rowH*.43,13*dpr);
    const radius=Math.min(3*dpr,rh*.3);
    ctx.beginPath();ctx.roundRect(x-rw/2,cy-rh/2,rw,rh,radius);ctx.fill();
   }else{
    ctx.fillStyle=isChanged?'#eacba3':'#8c8f8a';
    ctx.fillRect(x-2*dpr,cy-5*dpr,4*dpr,10*dpr);
   }
   if(selectedCell&&selectedCell.id===ids[i]&&selectedCell.step===step){
    ctx.strokeStyle='#f2cfae';ctx.lineWidth=1.5*dpr;ctx.strokeRect(x-colW*.44,cy-rowH*.43,colW*.88,rowH*.86);
   }
  }
  // Empty-but-changed cells are shown as outlined ghosts in A/B compare.
  for(const d of (changed||[]).filter(change=>change.id===ids[i]&&!p.includes(change.i))){
    const cx=left+d.i*colW+colW*.5,cy=y+rowH*.5;
    ctx.strokeStyle='rgba(245,207,168,.85)';ctx.lineWidth=1.1*dpr;
    ctx.setLineDash([2*dpr,2*dpr]);
    ctx.strokeRect(cx-colW*.30,cy-rowH*.26,colW*.60,rowH*.52);
    ctx.setLineDash([]);
  }
 }
 ctx.fillStyle='#938071';ctx.textAlign='left';ctx.font=(9*dpr)+'px system-ui';ctx.fillText('BASS SAMPLES',9*dpr,top-14*dpr);
 ctx.fillText('FOUND TEXTURES',9*dpr,top+6*rowH-8*dpr);
 ctx.textAlign='right';ctx.fillText('ONE LOOP →',width-right,top-13*dpr);
 const repeatText=result.hasRepeat?'TWO MATCHING GESTURES':'NO MATCHING GESTURE';
 ctx.fillStyle='#b79f8d';ctx.fillText(repeatText,width-right,height-7*dpr);
 memoryScene={left,top,colW,rowH,dpr};
}
canvas.addEventListener('click',async ev=>{
 if(view!=='memory'||!memoryScene)return;
 const rect=canvas.getBoundingClientRect();
 const X=(ev.clientX-rect.left)*(canvas.width/rect.width),Y=(ev.clientY-rect.top)*(canvas.height/rect.height);
 const row=Math.floor((Y-memoryScene.top)/memoryScene.rowH),step=Math.floor((X-memoryScene.left)/memoryScene.colW);
 if(row<0||row>=9||step<0||step>15)return;
 const id=ids[row];selectedCell={id,step};
 const occupied=pattern[id].includes(step);
 el('bmNote').textContent=labels[id]+' / STEP '+readableStep(step)+(occupied?' / PLAYS':' / EMPTY');
 if(occupied){try{await initialize();voice(audio,id,audio.currentTime+.01,.85)}catch(e){setStatus('Could not audition note: '+e.message)}}
});
draw=function(){
 if(view==='memory'){drawMemory();requestAnimationFrame(draw)}
 else oldDraw();
};
const prevSetStatus=setStatus;
setStatus=function(s){prevSetStatus(s);el('bmiState').textContent=playing?'LIVE / LOOP '+String(Math.floor(stepCount/16)+1).padStart(2,'0'):'READY / PATTERN MAP'};
const eventRefresh=()=>{const newSig=patternSignature(pattern);if(newSig!==lastSignature){lastSignature=newSig;showScan()}requestAnimationFrame(eventRefresh)};
requestAnimationFrame(eventRefresh);
if(modes?.querySelector('[data-vis="memory"]'))modes.querySelector('[data-vis="memory"]').click();
showScan();
})();