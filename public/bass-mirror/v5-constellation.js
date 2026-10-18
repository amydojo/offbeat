/* OFFBEAT MEMORY V5 — musical event constellation; audio & state remain V2/V3-owned. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const engine=window.OFFBEAT_MEMORY_ENGINE, canvas=$('scope');
if(!engine||!canvas||!canvas.getContext)return;
document.body.classList.add('bm-v5');
canvas.tabIndex=0;
canvas.setAttribute('aria-label','Musical constellation. X is time, node height distinguishes samples, arcs connect matching returning gestures. Tap a star to hear it.');
const art=canvas.closest('.hero-art');
const header=document.createElement('div');header.className='v5-header';
header.innerHTML='<span>MEMORY / CONSTELLATION</span><span id="v5Live">● YOUR PLAYING</span>';
art.insertAdjacentElement('beforebegin',header);
const panel=document.createElement('div');panel.className='v5-panel';
panel.innerHTML='<div class="v5-key"><span><i class="v5-dot"></i> NOTE</span><span><i class="v5-stroke"></i> PHRASE</span><span><i class="v5-arc"></i> RETURN</span></div>'+
'<div class="v5-prompt"><span id="v5Hint">Follow the sound you keep returning to.</span><button id="v5Suggest">↗ TRY A BRANCH</button></div>'+
'<div class="v5-compare" id="v5Compare" hidden><span id="v5CompareTitle">ALTERNATE PATH</span><div class="v5-compare-buttons"><button id="v5Before">A · ORIGINAL</button><button id="v5After">B · ALTERNATE</button><button id="v5Keep">KEEP</button><button id="v5Discard" aria-label="Discard variation">✕</button></div></div>';
art.insertAdjacentElement('afterend',panel);
const kinds=['low','pulse','rise','spark','other','shift','knock','tick','scrape'];
const yRole={low:.57,pulse:.33,rise:.44,spark:.17,other:.7,shift:.79,knock:.91,tick:.87,scrape:.95};
const bassKind=id=>kinds.indexOf(id)<6;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
let hitAreas=[],ghostAreas=[],selected='',scene=null,lastPaint=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const activeMode=()=>document.querySelector('.bm-modes [data-vis][aria-pressed="true"]')?.dataset.vis||'memory';
function geometry(w,h,d){
 const left=Math.max(24*d,w*.075),right=Math.max(20*d,w*.06),top=Math.max(60*d,h*.19),bottom=Math.max(48*d,h*.15);
 const height=Math.max(40,h-top-bottom),width=w-left-right;
 return {left,right,top,bottom,height,width,x:s=>left+(s+.5)*width/16,y:id=>top+height*(yRole[id]||.6)};
}
function nodesFor(p,g){
 const list=[];
 for(const id of kinds){for(const step of p[id]||[])list.push({id,step,x:g.x(step),y:g.y(id),bass:bassKind(id)})}
 return list.sort((a,b)=>a.step-b.step||kinds.indexOf(a.id)-kinds.indexOf(b.id));
}
function paint(){
 const c=canvas.getContext('2d'),d=Math.min(devicePixelRatio||1,2);
 const W=Math.max(220,Math.round((canvas.clientWidth||320)*d)),H=Math.max(220,Math.round((canvas.clientHeight||320)*d));
 if(W!==canvas.width||H!==canvas.height){canvas.width=W;canvas.height=H}
 const state=engine.read(),currentEvolution=window.OFFBEAT_EVOLUTION?.visualState();
 if(currentEvolution&&!state.proposal){state.pattern=currentEvolution.pattern;state.repeated=currentEvolution.repeated}
 const geo=geometry(W,H,d),nodes=nodesFor(state.pattern,geo),bass=nodes.filter(n=>n.bass),drum=nodes.filter(n=>!n.bass);
 const returned=state.repeated.hasRepeat?state.repeated.pairs:[];
 const highlighted=new Set();
 for(const pair of returned){
  highlighted.add(pair.id+':'+(state.repeated.start+pair.offset));
  highlighted.add(pair.id+':'+(state.repeated.start+pair.offset+8));
 }
 const live=typeof playing!=='undefined'&&playing?(stepCount+15)%16:-1;
 c.fillStyle='#17110e';c.fillRect(0,0,W,H);
 const halo=c.createRadialGradient(W*.47,H*.36,0,W*.5,H*.4,W*.76);
 halo.addColorStop(0,'rgba(143,75,51,.19)');halo.addColorStop(.6,'rgba(60,34,27,.045)');halo.addColorStop(1,'rgba(60,34,27,0)');
 c.fillStyle=halo;c.fillRect(0,0,W,H);
 c.font=(9*d)+'px system-ui';c.textAlign='center';
 for(const tick of [0,4,8,12,15]){
  const x=geo.x(tick);
  c.strokeStyle=tick===8?'rgba(230,163,121,.21)':'rgba(209,160,126,.09)';
  c.lineWidth=d;c.beginPath();c.moveTo(x,geo.top-16*d);c.lineTo(x,H-geo.bottom+14*d);c.stroke();
  c.fillStyle=tick===8?'#cca081':'#927869';c.fillText(String(tick+1).padStart(2,'0'),x,H-20*d);
 }
 c.textAlign='left';c.fillStyle='#ba947b';c.fillText('START',geo.left,geo.top-25*d);
 c.textAlign='right';c.fillStyle='#907968';c.fillText('TIME →',W-geo.right,geo.top-25*d);
 // Incidental finger noises stay as small faint satellites.
 for(const n of drum){c.fillStyle='rgba(168,140,119,.41)';c.beginPath();c.arc(n.x,n.y,1.65*d,0,Math.PI*2);c.fill()}
 // Ordered bass events create the main luminous musical path.
 for(let i=1;i<bass.length;i++){
  const a=bass[i-1],b=bass[i],mx=(a.x+b.x)/2,hot=a.step===live||b.step===live;
  c.beginPath();c.moveTo(a.x,a.y);c.bezierCurveTo(mx,a.y,mx,b.y,b.x,b.y);
  c.strokeStyle=hot?'rgba(242,158,112,.22)':'rgba(211,118,82,.10)';c.lineWidth=(hot?10:7)*d;c.stroke();
  c.strokeStyle=hot?'rgba(255,209,163,.87)':'rgba(221,151,108,.54)';c.lineWidth=(hot?1.9:1.2)*d;c.stroke();
 }
 // Dashed overhead links encode genuine repeated (sample, relative position) events.
 for(const pair of returned){
  const a=bass.find(n=>n.id===pair.id&&n.step===state.repeated.start+pair.offset);
  const b=bass.find(n=>n.id===pair.id&&n.step===state.repeated.start+pair.offset+8);
  if(!a||!b)continue;
  const apex=Math.max(geo.top-5*d,Math.min(a.y,b.y)-45*d);
  c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo((a.x+b.x)/2,apex,b.x,b.y);
  c.strokeStyle='rgba(240,165,113,.14)';c.lineWidth=7*d;c.stroke();
  c.save();c.setLineDash([3*d,5*d]);c.strokeStyle='rgba(255,190,142,.75)';c.lineWidth=1.1*d;c.stroke();c.restore();
 }
 for(const n of bass){
  const key=n.id+':'+n.step,rep=highlighted.has(key),now=n.step===live,sel=selected===key;
  const r=(rep?4.3:3.3)*d+(now?2.5*d:0)+(sel?1.3*d:0);
  const g=c.createRadialGradient(n.x,n.y,0,n.x,n.y,r*3.8);
  g.addColorStop(0,rep?'rgba(255,210,161,.62)':'rgba(245,169,118,.4)');
  g.addColorStop(.28,rep?'rgba(239,145,88,.25)':'rgba(229,131,83,.14)');g.addColorStop(1,'rgba(229,131,83,0)');
  c.fillStyle=g;c.beginPath();c.arc(n.x,n.y,r*3.8,0,Math.PI*2);c.fill();
  c.fillStyle=now?'#fff1dc':rep?'#ffd5a4':'#de966d';c.beginPath();c.arc(n.x,n.y,r,0,Math.PI*2);c.fill();
  if(now||sel){c.strokeStyle='rgba(248,219,183,.76)';c.lineWidth=d;c.beginPath();c.arc(n.x,n.y,r+6*d,0,Math.PI*2);c.stroke()}
 }
 const named=bass.find(n=>n.id+':'+n.step===selected)||bass.find(n=>n.step===live);
 if(named){
  c.font='600 '+(10*d)+'px system-ui';c.textAlign='center';c.fillStyle='#f5d3b5';
  c.fillText(named.id.toUpperCase()+' · '+String(named.step+1).padStart(2,'0'),clamp(named.x,48*d,W-48*d),Math.max(geo.top-4*d,named.y-17*d));
 }
 // Add only a few stable labels: clear identity without turning stars into a labeled grid.
 for(const id of ['low','pulse','rise','spark']){
  const first=bass.find(n=>n.id===id);if(!first||selected===id+':'+first.step||first.step===live)continue;
  c.font='500 '+(9*d)+'px system-ui';c.textAlign='center';c.fillStyle='rgba(229,194,167,.78)';
  c.fillText(id.toUpperCase(),clamp(first.x,31*d,W-31*d),Math.min(H-geo.bottom-8*d,first.y+19*d));
 }
 // Proposed variation appears as a distinct dotted branch until the user keeps/discards it.
 ghostAreas=[];
 if(state.proposal){
  const p=state.proposal,other=p.current==='before'?p.after:p.before;
  for(const diff of p.diffs){
   const x=geo.x(diff.i),y=geo.y(diff.id),present=(state.pattern[diff.id]||[]).includes(diff.i);
   c.save();c.strokeStyle='#f5ce98';c.lineWidth=1.7*d;c.setLineDash([2.8*d,3.2*d]);
   c.beginPath();c.arc(x,y,9.5*d,0,Math.PI*2);c.stroke();c.setLineDash([]);
   if(!present){
    ghostAreas.push({id:diff.id,step:diff.i,x,y,variant:state.proposal.current==='before'?'after':'before'});
    const near=bass.reduce((a,b)=>!a||Math.abs(b.x-x)<Math.abs(a.x-x)?b:a,null);
    if(near){c.beginPath();c.moveTo(near.x,near.y);c.quadraticCurveTo((near.x+x)/2,Math.min(near.y,y)-31*d,x,y);
     c.setLineDash([3*d,4*d]);c.strokeStyle='rgba(248,204,145,.75)';c.lineWidth=1.4*d;c.stroke()}
    c.fillStyle='#edd4a7';c.beginPath();c.arc(x,y,2.8*d,0,Math.PI*2);c.fill();
   }
   c.restore();
  }
 }
 c.font='600 '+(9*d)+'px system-ui';c.fillStyle='#bc9980';c.textAlign='left';
 c.fillText(returned.length?String(returned.length)+' MATCHED RETURNS':'NO RETURN DETECTED',geo.left,H-37*d);
 hitAreas=bass;scene={W,H,d};
}
const prevDraw=draw;
draw=function(){
 if(activeMode()!=='memory'){prevDraw();return}
 const now=performance.now(),gap=reduced.matches?78:(typeof playing!=='undefined'&&playing?30:50);
 if(now-lastPaint>=gap){lastPaint=now;paint()}
 requestAnimationFrame(draw);
};
function sync(){
 const p=engine.read().proposal;
 $('v5Compare').hidden=!p;$('v5Suggest').hidden=!!p;
 if(p){
  $('v5CompareTitle').textContent=p.heading||'ALTERNATE PATH';
  $('v5Before').classList.toggle('v5-current',p.current==='before');
  $('v5After').classList.toggle('v5-current',p.current==='after');
 }else{
  const rpt=engine.read().repeated;
  $('v5Hint').textContent=rpt.hasRepeat?String(rpt.pairs.length)+' matching notes return in the second phrase.':'Find the next musical connection.';
 }
 const active=typeof playing!=='undefined'&&playing;
 const evolution=window.OFFBEAT_EVOLUTION?.visualState();
 $('v5Live').textContent=active&&evolution?'● BAR '+String(evolution.index+1).padStart(2,'0')+' / '+evolution.name:active?'● GROOVE PLAYING':'● YOUR PLAYING';
 $('v5Live').classList.toggle('v5-playing',active);
}
function audition(n){
 selected=n.id+':'+n.step;
 const note=n.id.toUpperCase()+' · '+String(n.step+1).padStart(2,'0');
 if($('mobCue'))$('mobCue').textContent=note;
 if($('bmNote'))$('bmNote').textContent=note;
 void initialize().then(()=>voice(audio,n.id,audio.currentTime+.015,.85)).catch(e=>{
  if($('mobCue'))$('mobCue').textContent='Sound unavailable: '+e.message;
 });
}
canvas.addEventListener('click',e=>{
 if(activeMode()!=='memory'||!scene)return;
 const bounds=canvas.getBoundingClientRect(),x=(e.clientX-bounds.left)*scene.W/bounds.width,y=(e.clientY-bounds.top)*scene.H/bounds.height;
 const ghost=ghostAreas.find(n=>Math.hypot(x-n.x,y-n.y)<=18*scene.d);
 if(ghost){
  if(ghost.variant==='before')engine.before();else engine.after();
  selected=ghost.id+':'+ghost.step;
  sync();return;
 }
 let best=null,dist=Infinity;
 for(const n of hitAreas){const distance=Math.hypot(x-n.x,y-n.y);if(distance<dist){best=n;dist=distance}}
 if(best&&dist<23*scene.d)audition(best);
});
canvas.addEventListener('keydown',e=>{
 if(activeMode()!=='memory'||!hitAreas.length||!['ArrowLeft','ArrowRight','Enter',' '].includes(e.key))return;
 e.preventDefault();
 const i=Math.max(0,hitAreas.findIndex(n=>n.id+':'+n.step===selected));
 const step=e.key==='ArrowLeft'?Math.max(0,i-1):e.key==='ArrowRight'?Math.min(hitAreas.length-1,i+1):i;
 const n=hitAreas[step];selected=n.id+':'+n.step;
 if(e.key==='Enter'||e.key===' ')audition(n);
 else if($('mobCue'))$('mobCue').textContent=n.id.toUpperCase()+' · '+(n.step+1)+' · ENTER TO HEAR';
});
$('v5Suggest').onclick=()=>{if(engine.propose()){engine.after();sync()}else if($('v5Hint'))$('v5Hint').textContent=$('status')?.textContent||'No alternate found'};
$('v5Before').onclick=()=>{engine.before();sync()};
$('v5After').onclick=()=>{engine.after();sync()};
$('v5Keep').onclick=()=>{engine.keep();sync()};
$('v5Discard').onclick=()=>{engine.discard();sync()};
let stateKey='',lastCheck=0;
function observe(t){
 if(t-lastCheck>180){
  lastCheck=t;
  const key=JSON.stringify(engine.read().proposal)+'|'+(typeof playing!=='undefined'&&playing);
  if(key!==stateKey){stateKey=key;sync()}
 }
 requestAnimationFrame(observe);
}
sync();requestAnimationFrame(observe);
})();