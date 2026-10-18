/* OFFBEAT BASS MIRROR 002 — Safari-safe sound + live visual modes. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('scope'), pen=canvas.getContext('2d');
const source=new Audio('data:audio/mpeg;base64,'+SAMPLE_DATA.low);
source.preload='none';source.playsInline=true;
const lab=document.createElement('section');lab.className='bm-lab';
const tabs=document.createElement('div');tabs.className='bm-bar';
tabs.innerHTML='<span>01 / SOUND BECOMES FORM</span><div class="bm-modes"><button data-vis="form" aria-pressed="true">FORM</button><button data-vis="spectrum" aria-pressed="false">FREQUENCY</button><button data-vis="memory" aria-pressed="false">MEMORY</button></div>';
const art=canvas.closest('.hero-art');art.parentNode.insertBefore(lab,art);
lab.appendChild(tabs);lab.appendChild(art);
const signal=document.createElement('span');signal.className='bm-signal';signal.innerHTML='<i id="bmLight"></i><span id="bmState">AWAITING AUDIO</span>';art.appendChild(signal);
const below=document.createElement('div');below.className='bm-below';below.innerHTML='<strong id="bmNote">NO SOUND YET</strong><span id="bmDescriptor">TAP A PAD · WATCH IT RESPOND</span>';lab.appendChild(below);
const boost=document.createElement('label');boost.className='bm-boost';boost.innerHTML='<input type="checkbox" id="bmBoost" checked> PHONE SPEAKER BOOST';
$('status').parentElement.appendChild(boost);
const preview=document.createElement('section');preview.className='bm-preview';
preview.innerHTML='<div><strong>HEAR YOUR BASS DIRECTLY</strong><span>An original hit from your session 3.3. If the sequencer is silent, test this player.</span></div><audio id="bmSource" controls playsinline preload="none" aria-label="Original bass sample"></audio>';
const bank=$('bank');bank.parentNode.insertBefore(preview,bank.previousElementSibling);$('bmSource').src=source.src;
let selected='form',intensity=0,impact=0,phase=0,touchX=.5,decodeTask=null,hiGain=null,hiInput=null;
const notes=[],wave=new Uint8Array(2048),spec=new Uint8Array(1024);
const names={form:['THE SHAPE OF YOUR PLAYING','AMPLITUDE / RESONANCE'],spectrum:['FREQUENCIES INSIDE THE SOUND','LOW → HIGH / LIVE'],memory:['THE NOTES YOU CHOSE TO KEEP','PAST → PRESENT / 16 SECONDS']};
tabs.querySelectorAll('[data-vis]').forEach(b=>b.onclick=()=>{
 selected=b.dataset.vis;tabs.querySelectorAll('[data-vis]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 document.querySelector('.bm-lab .art-label')?.replaceChildren(document.createTextNode(names[selected][0]));
 $('bmDescriptor').textContent=names[selected][1];
});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();touchX=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))},{passive:true});
const bass=id=>!['knock','tick','scrape'].includes(id);
createGraph=function(ctx,out){
 const master=ctx.createGain();master.gain.value=.82;
 const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.7;
 const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-20;compressor.knee.value=14;compressor.ratio.value=3;compressor.attack.value=.008;compressor.release.value=.20;
 master.connect(analyser);analyser.connect(compressor);compressor.connect(out);
 const send=ctx.createGain();send.gain.value=Number($('ghost').value)/100*.5;
 const delay=ctx.createDelay(1.5);delay.delayTime.value=.32;
 const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;
 const feedback=ctx.createGain();feedback.gain.value=.24;
 send.connect(delay);delay.connect(filter);filter.connect(feedback);feedback.connect(delay);filter.connect(master);
 const harmonicPre=ctx.createGain();harmonicPre.gain.value=1.8;
 const shaper=ctx.createWaveShaper();const curve=new Float32Array(1024);
 for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(3*x)/Math.tanh(3)}
 shaper.curve=curve;shaper.oversample='2x';
 const harmonicGain=ctx.createGain();harmonicGain.gain.value=$('bmBoost').checked?.28:0;
 harmonicPre.connect(shaper);shaper.connect(harmonicGain);harmonicGain.connect(master);
 return {master,analyser,send,delay,feedback,harmonicPre,harmonicGain};
};
initialize=async function(){
 if(!audio){
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio unsupported');
  audio=new C();
  const fx=createGraph(audio,audio.destination);
  master=fx.master;analyser=fx.analyser;echoDelay=fx.delay;echoFeedback=fx.feedback;echoSend=fx.send;hiInput=fx.harmonicPre;hiGain=fx.harmonicGain;
  // Crucially: unlock in the same tap gesture, before awaiting any decoder.
  const silent=audio.createBufferSource();silent.buffer=audio.createBuffer(1,1,audio.sampleRate);silent.connect(audio.destination);silent.start(0);
  audio.resume().catch(()=>{});
  setStatus('LOADING YOUR BASS…');
  decodeTask=Promise.allSettled(Object.entries(SAMPLE_DATA).map(async([id,s])=>{
    const raw=atob(s),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const result=await audio.decodeAudioData(bytes.buffer);
    if(result?.length)decoded[id]=result;
  })).then(results=>{
    const failures=results.filter(r=>r.status==='rejected').length;
    if(failures)setStatus(failures+' fragment(s) could not decode on this device.');
    return Object.keys(decoded).length;
  });
 }
 // Retry/resume must happen in the fresh physical tap BEFORE awaiting decoding.
 // Otherwise a suspended iOS AudioContext can stay locked after first failure.
 if(audio&&audio.state!=='running')audio.resume().catch(()=>{});
 await decodeTask;
 if(audio.state!=='running')await audio.resume();
 if(audio.state!=='running')throw Error('iPhone audio blocked. Test the direct player below, then tap PLAY.');
 if(Object.keys(decoded).length===0)throw Error('Audio decoding failed. Use the direct player below.');
 started=true;
 if(hiGain)hiGain.gain.setTargetAtTime($('bmBoost').checked?.28:0,audio.currentTime,.03);
};
const baseUpdate=updateControls;
updateControls=function(){baseUpdate();if(audio&&hiGain)hiGain.gain.setTargetAtTime($('bmBoost').checked?.28:0,audio.currentTime,.03)};
$('bmBoost').addEventListener('change',updateControls);
voice=function(ctx,id,when,volume=.7,graph=null){
 const dest=graph||{master,send:echoSend,harmonicPre:hiInput};if(!decoded[id]||!dest.master)return;
 const src=ctx.createBufferSource();src.buffer=decoded[id];
 const gain=ctx.createGain();gain.gain.value=volume*(bass(id)?.78:.42);
 src.connect(gain);gain.connect(dest.master);
 if(dest.send)gain.connect(dest.send);
 if(bass(id)&&dest.harmonicPre)gain.connect(dest.harmonicPre);
 src.start(Math.max(ctx.currentTime||0,when));
 if(ctx===audio&&!graph){
   notes.push({id,label:SAMPLE_INFO.find(a=>a[0]===id)?.[1]||id,time:performance.now()+Math.max(0,(when-audio.currentTime)*1000),volume});
   if(notes.length>140)notes.shift();
   $('bmNote').textContent=(SAMPLE_INFO.find(a=>a[0]===id)?.[1]||id).toUpperCase()+' / YOUR RECORDING';
   impact=Math.min(1,impact+.42*volume);
 }
 return src;
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&playing&&audio?.state!=='running')audio.resume().catch(()=>{})});
function line(x,y,a,b,color,weight=1){pen.beginPath();pen.moveTo(x,y);pen.lineTo(a,b);pen.strokeStyle=color;pen.lineWidth=weight;pen.stroke()}
draw=function(){
 const dpr=Math.min(window.devicePixelRatio||1,2),W=Math.max(2,Math.round((canvas.clientWidth||330)*dpr)),H=Math.max(2,Math.round((canvas.clientHeight||300)*dpr));
 if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
 const now=performance.now(),active=!!(audio&&audio.state==='running'&&started);
 let level=0;
 if(active&&analyser){analyser.getByteTimeDomainData(wave);analyser.getByteFrequencyData(spec);let sum=0;for(let i=0;i<2048;i+=4){const n=(wave[i]-128)/128;sum+=n*n}level=Math.min(1,Math.sqrt(sum/512)*4)}
 else{wave.fill(128);spec.fill(0)}
 intensity+=((active?level:0)-intensity)*.13;impact*=.938;phase+=.038;
 $('bmState').textContent=playing?(audio?.state==='running'?'LIVE / SOUND':'AUDIO PAUSED'):active?'READY / TAP A PAD':'AWAITING AUDIO';
 $('bmLight').classList.toggle('on',intensity>.035||impact>.12);
 pen.fillStyle='#150f0c';pen.fillRect(0,0,W,H);
 const glow=pen.createRadialGradient(W*.5,H*.49,0,W*.5,H*.49,W*.75);
 glow.addColorStop(0,'rgba(150,84,51,'+(.12+intensity*.19)+')');glow.addColorStop(1,'rgba(24,13,10,0)');
 pen.fillStyle=glow;pen.fillRect(0,0,W,H);
 for(let i=1;i<10;i++)line(i*W/10,0,i*W/10,H,'rgba(223,152,108,.045)',dpr);
 for(let j=1;j<7;j++)line(0,j*H/7,W,j*H/7,'rgba(223,152,108,.055)',dpr);
 pen.save();pen.beginPath();pen.rect(0,0,W,H);pen.clip();
 if(selected==='form'){
  for(let j=0;j<19;j++){
   const o=(j-9)/9,opacity=.055+(1-Math.abs(o))*.40;
   const g=pen.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(145,78,52,0)');g.addColorStop(.50,'rgba(239,169,119,'+opacity+')');g.addColorStop(1,'rgba(145,78,52,0)');
   pen.strokeStyle=g;pen.lineWidth=(j===9?1.5:.85)*dpr;pen.beginPath();
   for(let x=0;x<=W;x+=Math.max(2,3*dpr)){
    const t=x/W,envelope=Math.pow(Math.sin(Math.PI*t),1.35);
    const sample=(wave[Math.min(2047,Math.floor(t*2047))]-128)/128;
    const y=H*(.5+o*.16)+envelope*(sample*H*(.11+intensity*.62)+Math.sin(t*20+o*4.5+phase)*H*(.012+intensity*.105)+(touchX-.5)*H*(.045+intensity*.11)+o*impact*H*.13);
    if(!x)pen.moveTo(x,y);else pen.lineTo(x,y);
   }pen.stroke();
  }
 }else if(selected==='spectrum'){
  const N=70,left=W*.065,right=W*.94,bottom=H*.80;
  for(let i=0;i<N;i++){
   const t=i/(N-1),hz=30*Math.pow(2000/30,t),idx=Math.min(1023,Math.round(hz*2048/(audio?.sampleRate||44100)));
   let a=0;for(let dx=-1;dx<=1;dx++)a+=spec[Math.max(0,Math.min(1023,idx+dx))]/765;
   const h=Math.max(2*dpr,a*H*.62),x=left+t*(right-left),g=pen.createLinearGradient(0,bottom-h,0,bottom);
   g.addColorStop(0,'#e9b288');g.addColorStop(1,'#794834');pen.fillStyle=g;pen.fillRect(x,bottom-h,Math.max(2,(right-left)/N*.7),h);
  }
  line(left,bottom,right,bottom,'rgba(214,157,116,.35)',dpr);
  pen.font=(10*dpr)+'px monospace';pen.fillStyle='#a68d7b';
  for(const [hz,label] of [[40,'40'],[100,'100'],[250,'250'],[600,'600'],[1500,'1.5k']])pen.fillText(label,left+Math.log(hz/30)/Math.log(2000/30)*(right-left),bottom+18*dpr);
 }else{
  while(notes.length&&now-notes[0].time>16000)notes.shift();
  const pad=W*.10;line(pad,H*.5,W-pad,H*.5,'rgba(233,181,140,.23)',dpr);
  let prev=null;
  for(const n of notes){
   const age=Math.max(0,(now-n.time)/16000),x=W-pad-age*(W-2*pad),row=ROWS.indexOf(n.id),y=H*(.5+((row%6)-2.5)*.10),r=(3.5+6*n.volume)*dpr;
   if(prev)line(prev.x,prev.y,x,y,'rgba(212,130,89,.30)',dpr);
   const g=pen.createRadialGradient(x,y,0,x,y,r*2.3);g.addColorStop(0,'rgba(241,184,132,.8)');g.addColorStop(1,'rgba(221,129,81,0)');
   pen.fillStyle=g;pen.beginPath();pen.arc(x,y,r*2.3,0,Math.PI*2);pen.fill();
   pen.fillStyle=row>5?'#b48a73':'#f1ba8b';pen.beginPath();pen.arc(x,y,r*.48,0,Math.PI*2);pen.fill();
   if(age<.14){pen.fillStyle='#debdab';pen.font=(10*dpr)+'px monospace';pen.fillText(n.label,x,y-r-8*dpr)}
   prev={x,y};
  }
  pen.font=(10*dpr)+'px monospace';pen.fillStyle='#9f8576';pen.fillText('−16s',pad,H*.90);pen.fillText('NOW',W-pad-27*dpr,H*.90);
 }
 pen.restore();requestAnimationFrame(draw);
};
})();