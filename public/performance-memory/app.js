/* OFFBEAT · PERFORMANCE MEMORY
 * One-file local analyzer / audio A-B player / human confirmation UI.
 * No uploads or remote model calls. Stored choices contain timestamps only.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const core=window.OffbeatPhraseCore;
if(!core){$('error').textContent='Analysis engine unavailable. Refresh the page.';$('error').hidden=false;return}
const state={file:null,url:null,analysis:null,key:null,pairs:[],index:0,playing:null,clipEnd:0,decoding:false,
 waveform:[],selected:null,previousFocus:null};
const sound=$('player'),canvas=$('map');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clock=n=>{
 const seconds=Math.max(0,Math.floor(Number(n)||0));
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};
const pause=()=>{sound.pause();state.playing=null;state.clipEnd=0;['hearA','hearB'].forEach(id=>{
 const b=$(id);b.classList.remove('on');b.setAttribute('aria-pressed','false');
 });};
const storeKey=file=>'offbeat.perfmem.v1.'+[file.name,file.size,file.lastModified].join('.');
const safeRead=()=>{try{const v=JSON.parse(localStorage.getItem(state.key)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
const safeWrite=()=>{try{const decisions=state.pairs.filter(p=>p.verdict).map(p=>({a:p.a,b:p.b,verdict:p.verdict,score:p.score}));localStorage.setItem(state.key,JSON.stringify(decisions));return true}catch{return false}};
const setError=message=>{$('error').hidden=false;$('error').textContent=message};
function clearError(){$('error').hidden=true;$('error').textContent=''}
const status=message=>$('scanStatus').textContent=message;
function restoreVerdicts(){
 const saved=safeRead();
 for(const p of state.pairs){
  const match=saved.find(v=>Math.abs(v.a-p.a)<.3&&Math.abs(v.b-p.b)<.3);
  if(match)p.verdict=match.verdict;
 }
}
function activePair(){return state.pairs[state.index]||null}
function updateCounters(){
 const selected=state.pairs.filter(p=>p.verdict==='same').length;
 $('savedCount').textContent=selected;
 $('mapCount').textContent=state.pairs.length+' POSSIBLE RETURNS';
}
function select(index,{autoPlay=false}={}){
 if(!state.pairs.length)return;
 pause();state.index=(index+state.pairs.length)%state.pairs.length;
 const pair=activePair();
 $('compare').hidden=false;
 $('pairPosition').textContent='POSSIBLE RETURN '+String(state.index+1).padStart(2,'0');
 $('score').textContent=Math.round(pair.score*100)+'% TIMING SIMILARITY';
 $('timeA').firstChild.textContent=clock(pair.a)+' ';
 $('timeB').firstChild.textContent=clock(pair.b)+' ';
 $('browseCount').textContent=(state.index+1)+' / '+state.pairs.length;
 $('previous').disabled=state.pairs.length<2;$('next').disabled=state.pairs.length<2;
 $('same').classList.toggle('chosen',pair.verdict==='same');
 $('different').classList.toggle('chosen',pair.verdict==='different');
 $('same').setAttribute('aria-pressed',String(pair.verdict==='same'));
 $('different').setAttribute('aria-pressed',String(pair.verdict==='different'));
 $('compareCopy').textContent=pair.verdict==='same'?'You recognized this connection.':pair.verdict==='different'?'You decided these are different ideas.':'Does the musical thought return? Only you can decide.';
 draw();
 if(autoPlay)playClip('a');
}
function mark(verdict){
 const pair=activePair();if(!pair)return;
 pair.verdict=pair.verdict===verdict?null:verdict;
 safeWrite();updateCounters();select(state.index);
 $('mapTip').textContent=pair.verdict==='same'?'Saved your musical connection on this device.':pair.verdict==='different'?'Noted—this connection will no longer count as a discovery.':'Decision cleared.';
}
function playClip(which){
 const pair=activePair();if(!pair||!state.url)return;
 if(state.playing===which&&!sound.paused){pause();return}
 pause();
 const begin=which==='a'?pair.a:pair.b;
 try{
  state.clipEnd=Math.min(state.analysis.duration,begin+(pair.window||4.8));
  sound.currentTime=Math.max(0,begin);
  state.playing=which;
  const btn=$(which==='a'?'hearA':'hearB');
  btn.classList.add('on');btn.setAttribute('aria-pressed','true');
  const playRequest=sound.play(); // Called by a trusted user tap, required on iPhone.
  if(playRequest?.catch)playRequest.catch(e=>{pause();setError('Audio playback was blocked: '+e.message+'. Tap Hear A or B again.')});
 }catch(e){pause();setError('This audio moment could not play: '+e.message)}
}
sound.addEventListener('timeupdate',()=>{
 if(state.playing&&sound.currentTime>=state.clipEnd-.025){pause()}
 draw();
});
sound.addEventListener('ended',pause);
sound.addEventListener('error',()=>{
 if(state.url)setError('The browser cannot play this recording. Try converting it to M4A or WAV.');
});
function draw(){
 if(!state.analysis)return;
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 if(rect.width<10||rect.height<10)return;
 const W=Math.max(200,Math.round(rect.width*dpr)),H=Math.max(210,Math.round(rect.height*dpr)),c=canvas.getContext('2d');
 if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
 const duration=state.analysis.duration,xOf=t=>30*dpr+clamp(t/duration,0,1)*(W-60*dpr);
 c.fillStyle='#15100e';c.fillRect(0,0,W,H);
 const glow=c.createRadialGradient(W*.48,H*.26,0,W*.48,H*.29,W*.67);
 glow.addColorStop(0,'rgba(138,78,53,.15)');glow.addColorStop(1,'rgba(138,78,53,0)');
 c.fillStyle=glow;c.fillRect(0,0,W,H);
 const baseline=H*.79;
 const waveform=state.analysis.overview||[];
 for(let i=0;i<waveform.length;i++){
  const x=30*dpr+(i+.5)*(W-60*dpr)/waveform.length;
  const hh=(5+waveform[i]*29)*dpr;
  c.fillStyle='rgba(182,126,96,'+(.10+waveform[i]*.17)+')';
  c.fillRect(x-1*dpr,baseline-hh,1.7*dpr,hh*2);
 }
 for(const frac of [0,.25,.5,.75,1]){
  const x=30*dpr+frac*(W-60*dpr);
  c.beginPath();c.moveTo(x,23*dpr);c.lineTo(x,H-20*dpr);c.strokeStyle='rgba(216,164,132,.07)';c.lineWidth=dpr;c.stroke();
 }
 // Each match owns a distinct arc height. X-position is exact source time.
 const pairs=state.pairs,areas=[];
 pairs.forEach((pair,i)=>{
  const xa=xOf(pair.a),xb=xOf(pair.b);
  const active=i===state.index;
  const y1=H*(.60-(i%4)*.085),y2=H*(.60-((i+1)%4)*.083);
  const peak=clamp(Math.min(y1,y2)-H*(.20+Math.min(3,i%4)*.015),35*dpr,H*.49);
  const middle=(xa+xb)/2;
  const color=pair.verdict==='same'?'#c4dcae':pair.verdict==='different'?'#685b53':active?'#f7c69c':'#a5755b';
  const alpha=pair.verdict==='different'?.14:active?.93:.39;
  c.beginPath();c.moveTo(xa,y1);c.bezierCurveTo(middle,peak,middle,peak,xb,y2);
  c.strokeStyle=color;c.globalAlpha=alpha*.24;c.lineWidth=(active?9:6)*dpr;c.stroke();
  c.globalAlpha=alpha;c.lineWidth=(active?2:1.15)*dpr;c.stroke();
  c.globalAlpha=1;
  for(const n of [{x:xa,y:y1,t:pair.a},{x:xb,y:y2,t:pair.b}]){
   const r=(active?5.1:3.4)*dpr;
   const radial=c.createRadialGradient(n.x,n.y,0,n.x,n.y,r*4);
   radial.addColorStop(0,active?'rgba(250,204,155,.65)':'rgba(205,139,104,.24)');
   radial.addColorStop(1,'rgba(222,120,73,0)');
   c.fillStyle=radial;c.beginPath();c.arc(n.x,n.y,r*4,0,Math.PI*2);c.fill();
   c.fillStyle=color;c.globalAlpha=alpha;c.beginPath();c.arc(n.x,n.y,r,0,Math.PI*2);c.fill();c.globalAlpha=1;
   areas.push({x:n.x,y:n.y,index:i,t:n.t});
  }
  if(active){
   c.fillStyle='#f3c6a7';c.textAlign='center';c.font='600 '+(10*dpr)+'px system-ui';
   c.fillText(clock(pair.a)+' ↔ '+clock(pair.b),clamp(middle,63*dpr,W-63*dpr),Math.max(25*dpr,peak-9*dpr));
  }
 });
 if(!pairs.length){
  c.textAlign='center';c.font='500 '+(12*dpr)+'px system-ui';c.fillStyle='#aa8e7e';
  c.fillText('NO STRONG CONNECTIONS FOUND',W*.5,H*.43);
  c.font=(10*dpr)+'px system-ui';c.fillText('TAP THE TIMELINE TO LISTEN',W*.5,H*.48);
 }
 // Audio playhead tracks the actual native media timeline.
 if(!sound.paused&&Number.isFinite(sound.currentTime)){
  const x=xOf(sound.currentTime);
  c.beginPath();c.moveTo(x,21*dpr);c.lineTo(x,H-19*dpr);c.strokeStyle='rgba(245,222,179,.83)';c.lineWidth=1.2*dpr;c.stroke();
 }
 state.hitAreas=areas;state.mapSize={W,H};
}
function mapClick(e){
 if(!state.analysis)return;
 const bounds=canvas.getBoundingClientRect();
 const x=(e.clientX-bounds.left)*canvas.width/bounds.width;
 const y=(e.clientY-bounds.top)*canvas.height/bounds.height;
 let best=null,dist=Infinity;
 for(const n of state.hitAreas||[]){
  const d=Math.hypot(n.x-x,n.y-y);
  if(d<dist){dist=d;best=n}
 }
 if(best&&dist<25*(state.mapSize.W/bounds.width)){select(best.index);playClip(Math.abs(best.t-activePair().a)<1?'a':'b');return}
 if(!state.pairs.length){
  const t=clamp((x-30*(state.mapSize.W/bounds.width))/(state.mapSize.W-60*(state.mapSize.W/bounds.width)),0,1)*state.analysis.duration;
  pause();sound.currentTime=t;state.clipEnd=t+4.8;state.playing='manual';
  sound.play().catch(err=>setError(err.message));
 }
}
canvas.addEventListener('click',mapClick);
canvas.addEventListener('keydown',e=>{
 if(!state.pairs.length)return;
 if(e.key==='ArrowLeft'){e.preventDefault();select(state.index-1)}
 if(e.key==='ArrowRight'){e.preventDefault();select(state.index+1)}
 if(e.key==='Enter'||e.key===' '){e.preventDefault();playClip('a')}
});
$('previous').onclick=()=>select(state.index-1);
$('next').onclick=()=>select(state.index+1);
$('hearA').onclick=()=>playClip('a');$('hearB').onclick=()=>playClip('b');
$('timeA').onclick=()=>playClip('a');$('timeB').onclick=()=>playClip('b');
$('same').onclick=()=>mark('same');$('different').onclick=()=>mark('different');
$('replace').onclick=()=>{pause();$('audioFile').click()};
const sheet=$('sheet');
function closeSheet(){sheet.hidden=true;document.body.classList.remove('modal');state.previousFocus?.focus?.()}
function openSheet(title,body){
 state.previousFocus=document.activeElement;
 $('sheetTitle').textContent=title;$('sheetBody').replaceChildren();$('sheetBody').appendChild(body);
 sheet.hidden=false;document.body.classList.add('modal');$('closeSheet').focus();
}
$('scrim').onclick=closeSheet;$('closeSheet').onclick=closeSheet;
document.addEventListener('keydown',e=>{if(!sheet.hidden&&e.key==='Escape'){closeSheet();return}});
$('infoBtn').onclick=()=>{
 const block=document.createElement('div');block.className='explain';
 block.innerHTML='<p><strong>Find what comes back.</strong> The analyzer measures changes in volume, note-attack timing, and short-term energy across this recording. It suggests pairs that may share a rhythm.</p>'+
 '<p><strong>What it cannot know:</strong> whether you meant to repeat a riff, whether the notes are identical, or whether two phrases feel musically related to you. You confirm those connections.</p>'+
 '<p><strong>Privacy:</strong> audio decoding and analysis happen locally in this browser. Your file is never sent to OFFBEAT or GitHub. Confirmations are saved as timestamps on this device, not the audio itself.</p>'+
 '<p><strong>Tip:</strong> a phone may need a few moments to decode a long recording. For best compatibility, use M4A or WAV.</p>';
 openSheet('How Memory works',block);
};
$('savedBtn').onclick=()=>{
 const wrap=document.createElement('div');wrap.className='savedItems';
 const kept=state.pairs.filter(x=>x.verdict==='same');
 if(!kept.length){const p=document.createElement('p');p.textContent='No confirmed memories yet. When two moments feel related, tap Same Idea.';wrap.append(p)}
 kept.forEach(pair=>{
  const row=document.createElement('button');row.type='button';row.className='savedRow';
  const i=state.pairs.indexOf(pair);
  const label=document.createElement('span');label.textContent=clock(pair.a)+' ↔ '+clock(pair.b);
  const side=document.createElement('small');side.textContent='HEAR ↗';row.append(label,side);
  row.onclick=()=>{closeSheet();select(i);playClip('a')};
  wrap.append(row);
 });
 const info=document.createElement('p');info.className='savedNote';
 info.textContent='These connection timestamps are remembered locally. Reopen the same recording to hear them again.';
 wrap.append(info);openSheet('Your remembered riffs',wrap);
};
async function importFile(file){
 if(!file)return;
 if(state.decoding){setError('Audio is already being analyzed.');return}
 if(file.size>100*1024*1024){setError('This recording is unusually large. Please try a file under 100 MB.');return}
 pause();clearError();state.decoding=true;state.file=file;
 state.pairs=[];state.analysis=null;$('compare').hidden=true;$('work').hidden=false;
 $('importPanel').hidden=true;$('sessionName').textContent=file.name;
 $('mapTip').textContent='Finding returning ideas in your performance…';
 $('mapCount').textContent='ANALYZING';$('scanStatus').textContent='Reading your recording…';
 const prev=state.url;
 state.url=URL.createObjectURL(file);sound.src=state.url;sound.load();
 if(prev)URL.revokeObjectURL(prev);
 state.key=storeKey(file);
 await new Promise(resolve=>requestAnimationFrame(resolve));
 let context=null;
 try{
  // A low-rate offline decoder is used to reduce iPhone memory and processing cost.
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!Offline)throw Error('Your browser does not support local audio decoding.');
  context=new Offline(1,1,12000);
  status('Decoding audio privately on this device…');
  const raw=await file.arrayBuffer();
  const audio=await context.decodeAudioData(raw);
  if(audio.duration>40*60)throw Error('Recording is longer than the current 40-minute analysis limit.');
  status('Finding phrase attacks and recurring rhythmic shapes…');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const result=core.analyze(audio);
  state.analysis=result;state.pairs=result.matches;state.waveform=result.overview;
  state.index=0;restoreVerdicts();
  $('endTime').textContent=clock(result.duration);
  $('scanStatus').textContent=clock(result.duration)+' OF AUDIO · '+result.onsets+' ATTACK CANDIDATES';
  $('mapTip').textContent='Connections are suggestions. Listen to both moments and decide.';
  updateCounters();document.querySelector('.browse').hidden=!state.pairs.length;
  if(state.pairs.length){select(0)}
  else{
   $('compare').hidden=true;
   $('mapTip').textContent='No convincing rhythmic returns were found. Tap the timeline to hear any moment.';
  }
  draw();
 }catch(e){
  setError('Could not analyze this recording: '+(e?.message||'unknown error')+'. Try a WAV or M4A file and reopen the app.');
  status('ANALYSIS UNAVAILABLE');
  $('mapCount').textContent='—';
 }finally{state.decoding=false;context=null}
}
$('audioFile').onchange=e=>importFile(e.target.files?.[0]);
new ResizeObserver(()=>draw()).observe(canvas);
})();