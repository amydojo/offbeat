// One lightweight Web Audio drum voice library used for BOTH live and WAV export.
// The rhythmic schedule is created by the pure groove engine; no network or model.
const sample=(ctx,length,seed)=>{
 const n=Math.ceil(length*ctx.sampleRate),buffer=ctx.createBuffer(1,n,ctx.sampleRate),a=buffer.getChannelData(0);
 let x=(seed>>>0)||1;
 for(let i=0;i<n;i++){x^=x<<13;x^=x>>>17;x^=x<<5;a[i]=((x>>>0)/2147483648)-1;}
 return buffer;
};
export function playDrumVoice(ctx,out,event,when){
 const volume=Math.max(.03,Math.min(1,event.velocity));
 if(event.kind==='kick'){
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(138,when);
  osc.frequency.exponentialRampToValueAtTime(49,when+.105);
  gain.gain.setValueAtTime(.001,when);
  gain.gain.linearRampToValueAtTime(.62*volume,when+.007);
  gain.gain.exponentialRampToValueAtTime(.001,when+.21);
  osc.connect(gain).connect(out);osc.start(when);osc.stop(when+.22);
  return;
 }
 const hat=event.kind==='hat',duration=hat?.072:.155;
 const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 const seed=Math.floor(event.time_s*100000)+event.kind.length*763+Math.floor(volume*1000);
 src.buffer=sample(ctx,duration,seed);
 filter.type='highpass';filter.frequency.value=hat?5800:1200;
 gain.gain.setValueAtTime(Math.max(.0001,(hat?.18:.32)*volume),when);
 gain.gain.exponentialRampToValueAtTime(.0001,when+duration-.005);
 src.connect(filter).connect(gain).connect(out);
 src.start(when);src.stop(when+duration);
}
// All exported bytes are explicitly signed 16-bit PCM in a RIFF/WAVE container.
export function pcm16Wav(channel,sampleRate){
 if(!channel||!Number.isInteger(sampleRate)||sampleRate<=0)throw Error('Cannot encode an empty WAV.');
 const bytes=new ArrayBuffer(44+channel.length*2),view=new DataView(bytes);
 const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
 write(0,'RIFF');view.setUint32(4,36+channel.length*2,true);write(8,'WAVE');
 write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
 view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
 view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 write(36,'data');view.setUint32(40,channel.length*2,true);
 for(let i=0;i<channel.length;i++){
  const v=Math.max(-1,Math.min(1,channel[i]||0));
  view.setInt16(44+i*2,v<0?Math.round(v*32768):Math.round(v*32767),true);
 }
 return new Blob([bytes],{type:'audio/wav'});
}
export async function exportGrooveWav(file,pattern,sourceOffset=0){
 if(!file||!pattern)throw Error('Record a phrase before exporting a groove.');
 const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
 const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!Offline||!Audio)throw Error('Your browser does not support mixed WAV export.');
 const seconds=pattern.range.end_s-pattern.range.start_s;
 if(seconds<.25||seconds>16)throw Error('Export a selected phrase under 16 seconds.');
 const rate=22050;
 const decoder=new Audio();
 let original;
 try{original=await decoder.decodeAudioData(await file.arrayBuffer());}
 catch{throw Error('Unable to decode your original recording for WAV export.');}
 finally{await decoder.close();}
 const offline=new Offline(1,Math.ceil(seconds*rate),rate);
 const master=offline.createGain();master.gain.value=.75;master.connect(offline.destination);
 const player=offline.createBufferSource();player.buffer=original;
 const voice=offline.createGain();voice.gain.value=.7;
 voice.gain.setValueAtTime(.001,0);voice.gain.linearRampToValueAtTime(.7,Math.min(.018,seconds/5));
 voice.gain.setValueAtTime(.7,Math.max(.02,seconds-.035));
 voice.gain.linearRampToValueAtTime(.001,seconds-.002);
 player.connect(voice).connect(master);
 player.start(0,sourceOffset+pattern.range.start_s,seconds);
 const drum=offline.createGain();drum.gain.value=.76;drum.connect(master);
 for(const event of pattern.events){playDrumVoice(offline,drum,event,event.time_s);}
 const rendered=await offline.startRendering();
 const wav=pcm16Wav(rendered.getChannelData(0),rate);
 if(wav.type!=='audio/wav')throw Error('Unable to encode a valid WAV.');
 return wav;
}
export function saveWav(wav,title='offbeat-groove'){
 const name=String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'offbeat-groove';
 const url=URL.createObjectURL(wav);
 const a=document.createElement('a');a.href=url;a.download=name+'.wav';
 document.body.appendChild(a);
 try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 return a.download;
}
