/* OFFBEAT FORM / RHYTHM 002
   Fully local: deterministic browser synthesis + guarded pulse inference.
   No machine-learning model, no claim to recognize user intention. */
(function(root){
'use strict';
var clamp=function(x,a,b){return Math.max(a,Math.min(b,x));};
var noiseCache=new WeakMap();
function median(arr){var a=arr.slice().sort(function(x,y){return x-y});return a.length?a[Math.floor(a.length/2)]:null}
function estimateTempo(taps,previous){
  var prev=clamp(Number(previous)||100,65,155);
  if(!Array.isArray(taps)||taps.length<4)return {bpm:prev,confidence:'waiting',samples:0};
  var sorted=taps.filter(function(t){return Number.isFinite(t)}).slice(-18).sort(function(a,b){return a-b});
  var gaps=[];
  for(var i=1;i<sorted.length;i++){var d=sorted[i]-sorted[i-1];if(d>=.115&&d<=1.45)gaps.push(d)}
  if(gaps.length<3)return {bpm:prev,confidence:'waiting',samples:gaps.length};
  var best={score:Infinity,bpm:prev,error:Infinity};
  var divisions=[.5,1,1.5,2];
  for(var bpm=65;bpm<=155;bpm++){
    var beat=60/bpm,errs=[],weights=[];
    gaps.forEach(function(g){
      var e=Infinity,w=0;
      divisions.forEach(function(m){
        var d=Math.abs(g-beat*m)/(beat*m);
        // Favor a straightforward beat or eighth-note relationship.
        // A 1.5-beat interval should not masquerade as a faster regular pulse.
        var penalty=m===1?0:m===.5?.012:m===1.5?.045:.055;
        var score=d+penalty;
        if(score<e){e=score;w=1}
      });
      errs.push(Math.min(.7,e));weights.push(w)
    });
    var fit=median(errs);
    // Mild prior bias resolves half-time/double-time ambiguity without forcing it.
    var score=fit+.012*Math.abs(Math.log(bpm/prev));
    if(score<best.score)best={score:score,bpm:bpm,error:fit}
  }
  if(best.error>.155)return {bpm:prev,confidence:'low',samples:gaps.length};
  var limited=clamp(best.bpm,prev-18,prev+18);
  return {bpm:Math.round(prev*.55+limited*.45),confidence:best.error<.075&&gaps.length>=4?'steady':'learning',samples:gaps.length};
}
function noiseBuffer(ctx){
  if(noiseCache.has(ctx))return noiseCache.get(ctx);
  var rate=ctx.sampleRate||44100,count=Math.ceil(rate*.22);
  var b=ctx.createBuffer(1,count,rate),data=b.getChannelData(0);
  var state=928371;
  for(var i=0;i<count;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=((state>>>0)/2147483648)-1}
  noiseCache.set(ctx,b);return b;
}
function drum(ctx,destination,kind,when,velocity){
  var vol=clamp(Number(velocity)||.65,.05,1);
  if(kind==='kick'){
    var osc=ctx.createOscillator(),click=ctx.createOscillator();
    var low=ctx.createGain(),top=ctx.createGain();
    osc.type='sine';click.type='triangle';
    osc.frequency.setValueAtTime(145,when);osc.frequency.exponentialRampToValueAtTime(54,when+.11);
    click.frequency.setValueAtTime(260,when);click.frequency.exponentialRampToValueAtTime(110,when+.035);
    low.gain.setValueAtTime(.0001,when);low.gain.linearRampToValueAtTime(.52*vol,when+.004);low.gain.exponentialRampToValueAtTime(.0001,when+.22);
    top.gain.setValueAtTime(.21*vol,when);top.gain.exponentialRampToValueAtTime(.0001,when+.047);
    osc.connect(low);click.connect(top);low.connect(destination);top.connect(destination);
    osc.start(when);click.start(when);osc.stop(when+.23);click.stop(when+.052);
    return;
  }
  if(kind!=='snare'&&kind!=='hat')return;
  var hat=kind==='hat',n=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain(),dur=hat?.07:.15;
  n.buffer=noiseBuffer(ctx);filter.type='highpass';filter.frequency.value=hat?5700:1550;
  env.gain.setValueAtTime(Math.max(.0001,(hat?.22:.36)*vol),when);
  env.gain.exponentialRampToValueAtTime(.0001,when+dur);
  n.connect(filter);filter.connect(env);env.connect(destination);n.start(when);n.stop(when+dur+.002);
}
function pocketTime(t,anchor,bpm,mode){
  if(mode==='raw'||!Number.isFinite(t))return t;
  var beat=60/clamp(bpm||100,65,155),grid=beat/4;
  var snapped=anchor+Math.round((t-anchor)/grid)*grid;
  var max=mode==='tight'?.070:.030;
  return Math.max(0,t+clamp((snapped-t)*(mode==='tight'?.85:.52),-max,max));
}
function kitEvents(events,anchor,bpm,mode){
  var out=events.map(function(e){return Object.assign({},e)});
  if(mode==='raw')return out;
  // Shift a whole melody gesture as one unit: onset + every pitch bend + release.
  // This preserves the shape and length of the player's physical expression.
  var active=null,segments=[];
  var order=out.map(function(e,i){return i}).sort(function(a,b){return out[a].t-out[b].t});
  order.forEach(function(i){
    var e=out[i];
    if(e.type==='down'){
      if(active&&active.length)segments.push(active);
      active=[i];
    }else if(active&&(e.type==='move'||e.type==='up'||e.type==='rest')){
      active.push(i);
      if(e.type==='up'||e.type==='rest'){segments.push(active);active=null}
    }
  });
  if(active&&active.length)segments.push(active);
  var previousEnd=0;
  segments.forEach(function(seg,n){
    var start=out[seg[0]].t,end=out[seg[seg.length-1]].t;
    var nextStart=n+1<segments.length?out[segments[n+1][0]].t:Infinity;
    var suggested=pocketTime(start,anchor,bpm,mode)-start;
    // Do not move a gesture through an adjacent note or before time zero.
    var delta=clamp(suggested,Math.max(-start,previousEnd-start),Math.max(0,nextStart-end-.002));
    seg.forEach(function(i){out[i].t=+Math.max(0,out[i].t+delta).toFixed(3)});
    previousEnd=end+delta;
  });
  out.forEach(function(e){
    if(e.type==='drum'&&!e.generated)e.t=+pocketTime(e.t,anchor,bpm,mode).toFixed(3);
  });
  return out;
}
root.OffbeatRhythm={estimateTempo:estimateTempo,drum:drum,pocketTime:pocketTime,kitEvents:kitEvents};
})(window);