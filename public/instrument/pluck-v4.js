/* OFFBEAT / FORM 004 — Actual bass-string excitation.
  Default sound is short one-shot string synthesis layered with sampled attack
  fragments from the user's own bass sessions. No continuous oscillator.
  Original notes and drums remain in the existing archive. */
(function(root){
'use strict';
var N=[73.416,87.307,97.999,110,130.813,146.832,174.614,195.998];
var clip=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
var bufferCache=new WeakMap(),sampleCache=new WeakMap();
function index(p){return Math.round(clip(p,0,1)*(N.length-1))}
function riff(p){return N[index(p)]}
function noise(seed){var x=seed|0||1;return function(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/2147483648*2-1}}
function stringBuffer(c,i,edge){
  var rate=c.sampleRate||44100, bank=bufferCache.get(c);
  if(!bank){bank={};bufferCache.set(c,bank)}
  var key=i+'-'+(edge?'edge':'round');
  if(bank[key])return bank[key];
  var f=N[i],length=Math.round(rate*.96),out=c.createBuffer(1,length,rate),arr=out.getChannelData(0);
  var L=Math.max(8,Math.round(rate/f-.5)),line=new Float32Array(L),rng=noise(72451+i*343+edge*91);
  // Pluck displacement excites a resonant delay line; harmonic balance is
  // set by excitation position rather than a fixed buzzing overtone.
  var pluckPos=edge?.29:.39,peak=0;
  for(var j=0;j<L;j++){
    var x=j/L;
    var tri=x<pluckPos?x/pluckPos:(1-x)/(1-pluckPos);
    line[j]=tri*.85+(rng()*(edge?.19:.09));
    peak+=line[j];
  }
  var mean=peak/L;
  for(var j=0;j<L;j++)line[j]-=mean;
  var cursor=0,last=0,low=0,feedback=edge?.993:.990;
  for(var k=0;k<length;k++){
    var a=line[cursor],b=line[(cursor+1)%L];
    // Smoothed averaging in the string feedback loop; damping high partials.
    var next=(a*.52+b*.48)*feedback;
    line[cursor]=next;cursor=(cursor+1)%L;
    low+=.18*(a-low);
    var attack=Math.min(1,k/(rate*.002));
    var tail=Math.exp(-Math.max(0,k/rate-.08)*(.95+(edge?-.25:0)));
    var body=(edge?a*.83+low*.17:a*.58+low*.42);
    arr[k]=body*.78*attack*tail;
    last=body;
  }
  bank[key]=out;return out;
}
function pitchOf(buffer){
  var a=buffer.getChannelData(0),rate=buffer.sampleRate,step=Math.max(1,Math.round(rate/11025));
  var from=Math.floor(rate*.09),until=Math.min(a.length,Math.floor(rate*.36));
  if(until-from<512)return null;
  var buf=[];
  for(var i=from;i<until;i+=step)buf.push(a[i]);
  var sum=0;for(var x=0;x<buf.length;x++)sum+=buf[x];
  var mean=sum/buf.length;for(var x=0;x<buf.length;x++)buf[x]-=mean;
  var max=0,best=0,interval=rate/step,low=Math.floor(interval/230),high=Math.min(Math.floor(interval/58),Math.floor(buf.length/2));
  for(var lag=low;lag<=high;lag++){
    var dot=0,l=0,r=0;
    for(var j=0;j<buf.length-lag;j++){var a=buf[j],b=buf[j+lag];dot+=a*b;l+=a*a;r+=b*b}
    var corr=dot/Math.sqrt(l*r+1e-12);
    if(corr>max){max=corr;best=lag}
  }
  return max>.55&&best?interval/best:null;
}
function preload(ctx){
  if(sampleCache.has(ctx))return sampleCache.get(ctx).promise;
  var state={sounds:{},promise:null};sampleCache.set(ctx,state);
  var bank=root.OffbeatBassSamples||{};
  var names=['low','pulse','rise','other'];
  state.promise=Promise.all(names.map(async function(name){
    try{
      var encoded=bank[name];if(!encoded)return;
      var bytes=Uint8Array.from(atob(encoded),function(c){return c.charCodeAt(0)});
      var decoded=await ctx.decodeAudioData(bytes.buffer);
      if(decoded.duration<.05)return;
      var base=pitchOf(decoded);
      state.sounds[name]={buffer:decoded,base:base};
    }catch(ignore){/* Physical string model stays available without samples. */}
  })).then(function(){return Object.keys(state.sounds).length>0});
  return state.promise;
}
function play(ctx,out,when,p,b,character){
  var at=Math.max(ctx.currentTime||0,when),i=index(p),bright=clip(b,0,1),edge=character==='edge',nodes=[],gains=[];
  var string=ctx.createBufferSource(),tone=ctx.createGain(),filter=ctx.createBiquadFilter();
  string.buffer=stringBuffer(ctx,i,edge);
  filter.type='lowpass';filter.Q.value=.45;
  filter.frequency.setValueAtTime(500+(edge?1700:950)*bright,at);
  tone.gain.setValueAtTime(0,at);
  tone.gain.linearRampToValueAtTime(.43,at+.008);
  tone.gain.exponentialRampToValueAtTime(.00015,at+.89);
  string.connect(filter);filter.connect(tone);tone.connect(out);
  string.start(at);string.stop(at+.92);
  nodes.push(string);gains.push(tone);
  var state=sampleCache.get(ctx),source=state&&state.sounds[edge?'pulse':'low'];
  if(source&&typeof ctx.createBufferSource==='function'){
    var sample=ctx.createBufferSource(),amp=ctx.createGain(),lp=ctx.createBiquadFilter();
    sample.buffer=source.buffer;
    // Estimate source pitch from a stable window; layer is intentionally
    // quiet when estimation is unreliable, so the modeled note stays in tune.
    var rate=source.base?clip(N[i]/source.base,.55,2.9):1;
    sample.playbackRate.setValueAtTime(rate,at);
    lp.type='lowpass';lp.frequency.value=850+bright*(edge?2600:1300);
    amp.gain.setValueAtTime(0,at);amp.gain.linearRampToValueAtTime(source.base?.21:.11,at+.008);
    amp.gain.exponentialRampToValueAtTime(.0001,at+.43);
    sample.connect(lp);lp.connect(amp);amp.connect(out);
    sample.start(at);sample.stop(at+Math.min(.45,source.buffer.duration/rate));
    nodes.push(sample);gains.push(amp);
  }
  return {sources:nodes,gains:gains,at:at,stopped:false};
}
function kill(v,t){
  if(!v||v.stopped)return;
  var at=Math.max(v.at+.006,t);v.stopped=true;
  v.gains.forEach(function(g){
    try{g.gain.cancelScheduledValues(at);g.gain.setValueAtTime(.00001,at)}catch(ignore){}
  });
  v.sources.forEach(function(s){try{s.stop(at+.005)}catch(ignore){}});
}
root.OffbeatPluck={play:play,kill:kill,preload:preload,index:index,pitch:riff,notes:N.slice(),pitchOf:pitchOf};
})(window);