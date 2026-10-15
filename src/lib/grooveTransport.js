import * as Tone from 'tone';
import { playDrumVoice } from './grooveAudio.mjs';
// All Tone.Transport IDs belong to this player. Never cancel foreign events
// owned by the sample playground or by another component.
let instance=null;
let launchNumber=0;
export function stopGroove(){
 launchNumber++;
 const current=instance;instance=null;
 if(!current)return;
 try{
  if(current.repeatId!==null)Tone.Transport.clear(current.repeatId);
  Tone.Transport.stop();
  const t=current.context?.currentTime||0;
  if(current.output){
   current.output.gain.cancelScheduledValues(t);
   current.output.gain.setValueAtTime(Math.max(.0001,current.output.gain.value),t);
   current.output.gain.setTargetAtTime(.0001,t,.008);
  }
  current.player?.stop();
 }catch{}
 try{current.player?.dispose();}catch{}
 try{current.output?.disconnect();}catch{}
}
export async function startGroove(fileUrl,pattern,onTick,sourceOffset=0){
 stopGroove();
 const mine=launchNumber;
 if(!fileUrl||!pattern?.events)throw Error('Choose a recorded phrase to groove with.');
 // Browser gesture unlock happens before any network-independent media decode.
 await Tone.start();
 const duration=pattern.range.end_s-pattern.range.start_s;
 if(duration<.25||duration>16)throw Error('Choose a phrase between 0.25 and 16 seconds.');
 const player=new Tone.Player({url:fileUrl,fadeIn:.018,fadeOut:.035,loop:false,autostart:false}).toDestination();
 try{await Tone.loaded();}
 catch{player.dispose();throw Error('Cannot decode this recording for groove playback.');}
 if(mine!==launchNumber){player.dispose();return false;}
 const raw=Tone.getContext().rawContext;
 if(!raw||typeof raw.createOscillator!=='function'){player.dispose();throw Error('Drum playback is unsupported in this browser.');}
 const output=raw.createGain();output.gain.value=.64;output.connect(raw.destination);
 const active={player,context:raw,output,repeatId:null};instance=active;
 // Repeat is in *seconds*, not beats, so original expression cannot be quantized.
 active.repeatId=Tone.Transport.scheduleRepeat((time)=>{
   if(instance!==active)return;
   player.start(time,sourceOffset+pattern.range.start_s,duration);
   for(const event of pattern.events)playDrumVoice(raw,output,event,time+event.time_s);
   onTick?.();
 },duration+'s',0);
 Tone.Transport.stop();
 Tone.Transport.position=0;
 Tone.Transport.start('+0.085');
 return true;
}
