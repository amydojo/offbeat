/* OFFBEAT / Memory Evolution v6
 * Shared deterministic arrangement for live scheduler, export, and visual feedback.
 * Audio state stays owned by the existing WebAudio engine.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id),core=window.OFFBEAT_EVOLUTION_CORE,mem=window.OFFBEAT_MEMORY_ENGINE;
if(!core||!mem)return;
const baseSnapshot=()=>mem.read().pattern;
let enabled=true,cached=null,signature='',selectedBar=0,selectedStart=0,lastUIBar=-1,showingComparison=false;
function refresh(base=baseSnapshot()){
 const key=core.signature(core.normalize(base));
 if(!cached||signature!==key){cached=core.compose(base);signature=key;lastUIBar=-1}
 return cached;
}
function comparing(){return !!mem.read().proposal}
function barNow(){
 const isPlaying=typeof playing!=='undefined'&&playing;
 return isPlaying?Math.floor(Math.max(0,stepCount-1)/16)%8:selectedBar;
}
function eventsAt(absoluteStep,base){
 if(!enabled||comparing())return null;
 return core.eventsAt(refresh(base),absoluteStep);
}
function repeated(p){
 const pairs=[];
 for(const start of [0,4]){
  const a=[],b=[];
  for(const id of core.BASS)for(let i=0;i<4;i++){
   if(p[id].includes(start+i))a.push(id+':'+i);
   if(p[id].includes(start+i+8))b.push(id+':'+i);
  }
  const match=a.filter(v=>b.includes(v)),union=new Set([...a,...b]).size;
  pairs.push({start,pairs:match.map(x=>({id:x.split(':')[0],offset:Number(x.split(':')[1])})),similarity:union?match.length/union:0});
 }
 pairs.sort((a,b)=>b.pairs.length-a.pairs.length||b.similarity-a.similarity);
 return {...pairs[0],hasRepeat:pairs[0].pairs.length>0};
}
function visualState(){
 if(!enabled||comparing())return null;
 const p=refresh(),index=barNow(),bar=p.bars[index];
 return {enabled,index,name:bar.name,detail:bar.detail,change:bar.change,
  difference:bar.difference,pattern:bar.pattern,repeated:repeated(bar.pattern)};
}
function pickBar(index){
 selectedBar=Math.max(0,Math.min(7,index|0));
 selectedStart=selectedBar*16;
 if(typeof playing!=='undefined'&&playing&&typeof audio!=='undefined'&&audio){
  // Existing WebAudio events cannot be unscheduled; < 120ms lookahead may finish.
  stepCount=selectedStart;
  nextTime=audio.currentTime+.14;
  barCount=selectedBar;
 } else{
  // When stopped, next real Play gesture starts the chosen bar.
  const cue=$('mobCue');if(cue)cue.textContent='BAR '+String(selectedBar+1).padStart(2,'0')+' · '+refresh().bars[selectedBar].name;
 }
 paintStrip(true);
}
function consumeStartStep(){return enabled?selectedStart:0}
const api=Object.freeze({
 get enabled(){return enabled},eventsAt,readPlan:()=>refresh(),visualState,
 get activeBar(){return barNow()},selectBar:pickBar,consumeStartStep,
 setEnabled(value){enabled=!!value;paintStrip(true);return enabled}
});
Object.defineProperty(window,'OFFBEAT_EVOLUTION',{configurable:true,value:api});
const target=document.querySelector('.v5-panel')||document.querySelector('.bm-lab');
const scene=document.createElement('section');scene.className='evo-scene';
scene.setAttribute('aria-label','Eight-bar musical evolution');
scene.innerHTML='<div class="evo-top"><span class="evo-eyebrow">08 / PHRASE DEVELOPMENT</span><button id="evoToggle" type="button" aria-pressed="true"><span class="evo-toggle-dot">●</span> EVOLVE ON</button></div>'+
'<div class="evo-path" id="evoPath"><svg id="evoSpark" viewBox="0 0 320 49" preserveAspectRatio="none" aria-hidden="true"></svg><div class="evo-points" id="evoPoints" role="group" aria-label="Jump to a bar"></div></div>'+
'<div class="evo-caption"><strong id="evoBarLabel">01 / FIND</strong><span id="evoActionLabel">Your original riff</span></div>';
target?.insertAdjacentElement('beforebegin',scene);
const points=$('evoPoints'),spark=$('evoSpark');
for(let i=0;i<8;i++){
 const b=document.createElement('button');b.type='button';b.className='evo-point';
 b.dataset.bar=String(i);b.setAttribute('aria-label','Audition bar '+(i+1));
 b.innerHTML='<span class="evo-node" aria-hidden="true"></span><span class="evo-step">'+String(i+1).padStart(2,'0')+'</span>';
 b.onclick=()=>{
  pickBar(i);
  // A bar selection while idle just cues playback; no synthetic/hidden playback.
 };
 points.appendChild(b);
}
$('evoToggle').addEventListener('click',()=>{
 enabled=!enabled;
 $('evoToggle').setAttribute('aria-pressed',String(enabled));
 $('evoToggle').innerHTML='<span class="evo-toggle-dot">●</span> '+(enabled?'EVOLVE ON':'LOOP ONLY');
 selectedBar=0;selectedStart=0;
 paintStrip(true);
});
function drawSpark(plan){
 // Novelty = number of changed placements vs the original; not inferred musical emotion.
 const values=plan.bars.map(b=>b.difference);
 const width=320,margin=19,max=Math.max(3,...values);
 const points=values.map((v,i)=>({x:margin+i*(width-2*margin)/7,y:30-v/max*20}));
 const d=points.map((v,i)=>(i?'L':'M')+v.x.toFixed(2)+' '+v.y.toFixed(2)).join(' ');
 const glows='<path d="'+d+'" fill="none" stroke="rgba(229,142,95,.23)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'+
 '<path d="'+d+'" fill="none" stroke="#cb8058" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
 const nodes=points.map((v,i)=>'<circle cx="'+v.x+'" cy="'+v.y+'" r="'+(i===0||i===7?'4':'3.2')+'" fill="'+(i===0||i===7?'#f4c49d':'#dd9972')+'"/>').join('');
 spark.innerHTML='<path d="M 19 30 H 301" stroke="rgba(221,160,121,.09)" fill="none"/>'+glows+nodes;
}
function paintStrip(force=false){
 const plan=refresh(),bar=barNow();
 if(!force&&bar===lastUIBar)return;
 lastUIBar=bar;
 drawSpark(plan);
 for(const el of points.children){
  const i=Number(el.dataset.bar);
  el.classList.toggle('active',i===bar);
  el.classList.toggle('changed',plan.bars[i].difference>0);
  el.setAttribute('aria-pressed',String(i===bar));
  el.setAttribute('aria-label','Bar '+String(i+1)+' '+plan.bars[i].name+', '+plan.bars[i].change+'. Tap to select.');
  const novelty=plan.bars[i].difference;const maxNovelty=Math.max(3,...plan.bars.map(b=>b.difference));
  el.style.setProperty('--node-y',(30-novelty/maxNovelty*20)+'px');
 }
 const b=plan.bars[bar];
 $('evoBarLabel').textContent=enabled?String(bar+1).padStart(2,'0')+' / '+b.name:'LOOP / ORIGINAL';
 $('evoActionLabel').textContent=enabled?b.change:'One bar repeating · eight-bar export';
 scene.classList.toggle('evo-off',!enabled);
 const live=$('v5Live');
 if(live&&typeof playing!=='undefined'&&playing&&enabled)live.textContent='● BAR '+String(bar+1).padStart(2,'0')+' / '+b.name;
}
let time=0;
function watch(timestamp){
 if(timestamp-time>150){time=timestamp;paintStrip()}
 requestAnimationFrame(watch);
}
paintStrip(true);requestAnimationFrame(watch);
})();