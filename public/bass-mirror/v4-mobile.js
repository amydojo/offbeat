/* OFFBEAT 004 — mobile listening surface and focused actions.
   Reuses the V2 audio engine, V3 Memory and constrained decision logic. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const mq=window.matchMedia('(max-width:780px)');
if(!mq.matches||!document.body.classList.contains('bm-v3')||!$('bmEngine'))return;
document.body.classList.add('bm-v4');
const shell=document.querySelector('main.shell'),lab=document.querySelector('.bm-lab'),insight=document.querySelector('.bm-inspector');
const stage=document.createElement('section');
stage.className='mob-stage';stage.setAttribute('aria-label','Music memory');
const top=document.createElement('header');top.className='mob-head';
top.innerHTML='<a href="/" aria-label="Back to OFFBEAT" class="mob-back">‹ <span>OFFBEAT</span></a><label class="mob-mode"><span class="mob-sr">Visualization mode</span><select id="mobMode" aria-label="Visualization mode"><option value="memory">MEMORY</option><option value="form">FORM</option><option value="spectrum">FREQUENCY</option></select><b aria-hidden="true">⌄</b></label><button id="mobSaved" class="mob-saved" aria-label="Open saved patterns">SAVED ◇</button>';
const dock=document.createElement('nav');dock.className='mob-dock';dock.setAttribute('aria-label','Instrument controls');
dock.innerHTML='<button id="mobPlay" class="mob-play" aria-label="Play loop"><b id="mobPlayGlyph">▶</b><span id="mobPlayText">PLAY</span></button><button id="mobChange"><b>✳</b><span>CHANGE</span></button><button id="mobEdit"><b>▦</b><span>EDIT</span></button><button id="mobKeep"><b>◇</b><span>KEEP</span></button>';
const overlay=document.createElement('div');overlay.className='mob-overlay';overlay.hidden=true;
overlay.innerHTML='<div class="mob-scrim"></div><section class="mob-sheet" role="dialog" aria-modal="true" aria-labelledby="mobTitle" tabindex="-1"><div class="mob-grip" aria-hidden="true"></div><header class="mob-sheet-head"><div><span id="mobEyebrow">OFFBEAT / STUDIO</span><h2 id="mobTitle">Make a change.</h2></div><button id="mobClose" aria-label="Close panel">✕</button></header><div class="mob-sheet-body"><div data-sheet="change" class="mob-sheet-page"></div><div data-sheet="edit" class="mob-sheet-page"></div><div data-sheet="saved" class="mob-sheet-page"></div><div data-sheet="about" class="mob-sheet-page"></div></div></section>';
const page=name=>overlay.querySelector('[data-sheet="'+name+'"]');
page('change').innerHTML='<div class="mob-sub">Keep the groove. Change one decision.</div><div class="mob-intent-title">HOW SHOULD IT CHANGE?</div><div class="mob-intents" role="group" aria-label="Variation direction"><button data-intent="answer" aria-pressed="true">+ Answer</button><button data-intent="echo">↻ Repeat</button><button data-intent="space">− Space</button><button data-intent="shift">↝ Timing</button></div>';
page('edit').innerHTML='<p class="mob-sub">Tap squares to change the loop. Try each sample below.</p>';
page('saved').innerHTML='<p class="mob-sub">Your favorites, kept on this device.</p>';
page('about').innerHTML='<p class="mob-sub">The map shows a 16-step loop made from your bass recordings.</p><p id="mobAboutFinding" class="mob-about-finding"></p><p id="mobAboutExplain"></p><p class="mob-about-small">Similarity here compares repeating sequencer placements, not pitch from your full recordings.</p>';
// Keep all the existing behavior by MOVING, never recreating, its live controls.
page('change').appendChild($('bmEngine'));
const vault=document.querySelector('.bm-vault');if(vault)page('saved').appendChild(vault);
const exp=$('export');if(exp){const area=document.createElement('section');area.className='mob-edit-group';area.innerHTML='<h3>EXPORT AUDIO</h3>';area.appendChild(exp);page('saved').appendChild(area)}
function moveSection(name,node,heading){if(!node)return;const wrap=document.createElement('section');wrap.className='mob-edit-group';const h=document.createElement('h3');h.textContent=heading;wrap.appendChild(h);wrap.appendChild(node);page(name).appendChild(wrap)}
moveSection('edit',document.querySelector('.presets'),'STARTING PATTERN');
moveSection('edit',$('bmSource')?.closest('.bm-preview'),'HEAR YOUR BASS');
moveSection('edit',$('bank'),'PLAY A SAMPLE');
moveSection('edit',document.querySelector('.gridbox'),'EDIT THE GRID · SWIPE →');
moveSection('edit',Array.from(document.querySelectorAll('.pane')).find(p=>p.querySelector('#tempo')),'TEMPO / FEEL');
moveSection('edit',$('bmBoost')?.closest('.bm-boost'),'PHONE SPEAKERS');
const stageTop=document.createElement('div');stageTop.className='mob-stage-heading';
stageTop.innerHTML='<span>YOUR MUSICAL MEMORY</span><button id="mobWhy">WHAT IS THIS? <span aria-hidden="true">ⓘ</span></button>';
stage.appendChild(stageTop);stage.appendChild(lab);stage.appendChild(insight);
const cue=document.createElement('div');cue.className='mob-cue';cue.innerHTML='<span id="mobCue">Tap a mark to hear it.</span><button id="mobHelp" aria-label="Explain the visual">?</button>';stage.appendChild(cue);
shell.insertBefore(top,shell.firstChild);shell.insertBefore(stage,top.nextSibling);shell.appendChild(dock);shell.appendChild(overlay);
const toast=document.createElement('div');toast.className='mob-toast';toast.hidden=true;toast.setAttribute('role','status');document.body.appendChild(toast);
let which=null,previousFocus=null,toastTimer=null,lastPlaying=null;
const headings={change:['DECISION ENGINE','Change one thing.'],edit:['YOUR SOUND BANK','Shape the groove.'],saved:['IDEA VAULT','Keep what you love.'],about:['THE MEMORY MAP','What am I seeing?']};
function notify(msg){toast.textContent=msg;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2300)}
function open(name){
 if(!headings[name])return;
 which=name;previousFocus=document.activeElement;overlay.hidden=false;document.body.classList.add('mob-sheet-open');
 $('mobEyebrow').textContent=headings[name][0];$('mobTitle').textContent=headings[name][1];
 overlay.querySelectorAll('.mob-sheet-page').forEach(p=>p.hidden=p.dataset.sheet!==name);
 overlay.querySelector('.mob-sheet-body').scrollTop=0;
 if(name==='about'){$('mobAboutFinding').textContent=$('bmiFinding')?.textContent||'';$('mobAboutExplain').textContent=$('bmiExplain')?.textContent||''}
 if(name==='change')syncIntents();
 requestAnimationFrame(()=>$('mobClose')?.focus({preventScroll:true}));
}
function close(){
 if(!which)return;which=null;overlay.hidden=true;document.body.classList.remove('mob-sheet-open');
 if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
}
$('mobClose').onclick=close;overlay.querySelector('.mob-scrim').onclick=close;
document.addEventListener('keydown',e=>{
 if(!which)return;
 if(e.key==='Escape'){e.preventDefault();close();return}
 if(e.key!=='Tab')return;
 const controls=Array.from(overlay.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')).filter(n=>n.getClientRects().length>0);
 if(!controls.length)return;
 if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus()}
 if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus()}
});
$('mobChange').onclick=()=>open('change');$('mobEdit').onclick=()=>open('edit');$('mobSaved').onclick=()=>open('saved');
$('mobWhy').onclick=()=>open('about');$('mobHelp').onclick=()=>open('about');
$('mobPlay').onclick=()=>{
 if(typeof playing!=='undefined'&&playing)$('stop').click();else $('play').click();
 syncTransport();
};
$('mobKeep').onclick=()=>{
 const save=$('bmSave'),input=$('bmIdeaName');
 if(!save||!input){open('saved');return}
 input.value='Memory · '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 save.click();notify('Saved to your Idea Vault');
};
const kind=$('bmAction');const intentButtons=page('change').querySelectorAll('[data-intent]');
function syncIntents(){intentButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.intent===kind?.value)))}
intentButtons.forEach(b=>b.onclick=()=>{if(kind){kind.value=b.dataset.intent;kind.dispatchEvent(new Event('change',{bubbles:true}))}syncIntents()});
kind?.addEventListener('change',syncIntents);
function preventLegacyScroll(id,name){
 $(id)?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open(name)},true);
}
preventLegacyScroll('bmiCreate','change');preventLegacyScroll('bmiEdit','edit');preventLegacyScroll('mutate','change');
$('mobMode').onchange=e=>{document.querySelector('.bm-modes [data-vis="'+e.target.value+'"]')?.click()};
function syncTransport(){
 const on=typeof playing!=='undefined'&&!!playing;
 if(on!==lastPlaying){lastPlaying=on;$('mobPlayText').textContent=on?'STOP':'PLAY';$('mobPlayGlyph').textContent=on?'■':'▶';$('mobPlay').setAttribute('aria-label',on?'Stop loop':'Play loop');$('mobPlay').setAttribute('aria-pressed',String(on))}
}
const originalCaption=lab.querySelector('.art-label');if(originalCaption)originalCaption.textContent='';
const activeView=document.querySelector('.bm-modes [data-vis="memory"]');activeView?.click();
const note=$('bmNote');if(note){
 const observer=new MutationObserver(()=>{
  const msg=note.textContent||'';
  if(msg&&!msg.includes('NO SOUND'))$('mobCue').textContent=msg.replace(' / YOUR RECORDING','').replace(' / STEP ',' · ');
 });
 observer.observe(note,{childList:true,characterData:true,subtree:true});
}
syncIntents();syncTransport();
const interval=setInterval(()=>{
 syncTransport();
 const active=document.querySelector('.bm-modes [data-vis][aria-pressed="true"]');
 if(active&&$('mobMode').value!==active.dataset.vis)$('mobMode').value=active.dataset.vis;
},250);
window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
window.__OFFBEAT_MOBILE_V4__={open,close,get sheet(){return which}};
})();