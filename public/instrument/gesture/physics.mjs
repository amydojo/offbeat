// FORM 009 — physical gesture -> deterministic musical intention.
// The hand manipulates a relationship field, not a named fret or point.
import {deformFrame,compileFrame,update,validate} from '../frame/core.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=v=>Number(v.toFixed(5));
export function sampleGesture({originX=.5,dx=0,dy=0,elapsed=240,travel=0}={}){
  const nx=clamp(dx/155,-1,1),ny=clamp(-dy/165,-1,1);
  const tension=clamp(Math.hypot(nx,ny),0,1);
  const speed=clamp((Math.hypot(dx,dy)/Math.max(50,elapsed))*1.2,0,1);
  const direction=Math.atan2(ny,nx);
  return {originX:round(clamp(originX,0,1)),nx:round(nx),ny:round(ny),
    tension:round(tension),speed:round(speed),direction:round(direction),
    travel:round(clamp(travel,0,8)),elapsed:Math.max(0,Math.round(elapsed))};
}
export function chooseAnchor(frame,x){
  const target=clamp(x,0,1)*8;
  return [...frame.notes].sort((a,b)=>Math.abs(a.beat-target)-Math.abs(b.beat-target))[0].id;
}
export function applyGesture(frame,gesture,anchor=chooseAnchor(frame,gesture.originX)){
  if(!validate(frame))throw Error('Invalid groove frame');
  const n=frame.notes.find(n=>n.id===anchor);
  if(!n)throw Error('Unknown anchor');
  const g=gesture;
  // The shape's elastic reach is felt immediately, but final notes settle
  // into the harmonic/pulse constraints of the existing Frame engine.
  const pitchDelta=g.ny*.49+g.tension*.045;
  const height=clamp(n.height+pitchDelta,.02,.98);
  let next=deformFrame(frame,anchor,height);
  const newDuration=clamp(n.duration+g.nx*.61,.18,1.46);
  const velocity=clamp(n.velocity+(g.tension-.30)*.25+g.speed*.14,.25,1);
  next={...next,
    notes:next.notes.map(x=>x.id===anchor?{...x,duration:round(newDuration),velocity:round(velocity)}:x),
    gestureMemory:[...(frame.gestureMemory||[]),{
      id:'gesture-'+next.revision,anchor,...g
    }].slice(-24)
  };
  return next;
}
export function compilePhysical(frame){
  const base=compileFrame(frame);
  const events=(frame.gestureMemory||[]).slice(-24);
  const extras=[];
  // Each energetic release can excite a distinct answer accent. Preserve
  // foundational kick/snare pulse; never rewrite the source gesture.
  const latestByAnchor=new Map(events.map(e=>[e.anchor,e]));
  for(const e of latestByAnchor.values()){
    if(e.tension<.21)continue;
    const source=frame.notes.find(n=>n.id===e.anchor);
    if(!source||source.rest)continue;
    const beat=(source.beat+.23+Math.max(0,e.nx)*.22)%8;
    const kind=e.speed>.65?'snare':e.tension>.62?'kick':'hat';
    const time=round(beat*60/frame.bpm);
    // Avoid doubling a main backbeat with a generated accent.
    if(base.drums.some(d=>d.kind===kind&&Math.abs(d.time-time)<.085))continue;
    extras.push({
      id:'physical:'+e.id,kind,time,beat:round(beat),
      velocity:round(clamp(.16+e.tension*.32+e.speed*.09,.15,.52)),
      origin:'generated',derivedFromIds:[e.anchor],
      reason:'physical_release',gestureId:e.id
    });
  }
  const drums=[...base.drums,...extras].sort((a,b)=>a.time-b.time);
  const all=[...base.bass,...base.harmony,...drums].sort((a,b)=>a.time-b.time);
  return {...base,drums,events:all,physicalResponses:extras};
}
export function physicsStep(p,target,dt=1/60){
  // stable semi-implicit spring with friction; release tends to the origin.
  const d=Math.min(.05,Math.max(.001,dt));
  const spring=target?.held?75:145,friction=target?.held?17:13;
  const tx=target?.x||0,ty=target?.y||0;
  const vx=(p.vx+(tx-p.x)*spring*d)*Math.exp(-friction*d);
  const vy=(p.vy+(ty-p.y)*spring*d)*Math.exp(-friction*d);
  return {x:p.x+vx*d,y:p.y+vy*d,vx,vy};
}
export function pulseEnvelope(p,t=0){
  return clamp(.5+.5*Math.cos(2*Math.PI*t+Math.PI),0,1);
}
