/* OFFBEAT Performance Memory / phrase analysis engine (browser + Node testable).
 * User audio stays in local browser memory. Candidate similarity ≠ confirmed riff identity.
 * Features: adaptive attack envelope, onset-spacing fingerprints, short-time energy contour.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.OffbeatPhraseCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function percentile(a,p){
 if(!a.length)return 0;
 const v=Array.from(a).sort((x,y)=>x-y);
 const pos=clamp(p,0,1)*(v.length-1),i=Math.floor(pos);
 return v[i]+(v[Math.min(v.length-1,i+1)]-v[i])*(pos-i);
}
function featureFrames(buffer,{hopSeconds=.046}={}){
 const sr=buffer.sampleRate,ch=buffer.getChannelData(0);
 const hop=Math.max(1,Math.floor(sr*hopSeconds));
 const len=Math.max(128,Math.floor(sr*.035));
 const count=Math.max(0,Math.floor((ch.length-len)/hop)+1);
 const energy=new Float32Array(count),edges=new Float32Array(count);
 const stride=Math.max(1,Math.floor(sr/3500));
 for(let i=0;i<count;i++){
  const pos=i*hop;let sum=0,diff=0,c=0,old=ch[pos]||0;
  for(let j=0;j<len;j+=stride){
   const v=ch[pos+j]||0;sum+=v*v;diff+=Math.abs(v-old);old=v;c++;
  }
  energy[i]=Math.sqrt(sum/Math.max(1,c));
  edges[i]=diff/Math.max(1,c);
 }
 return {energy,edges,hop:hop/sr,duration:buffer.duration};
}
function detectOnsets(frames){
 const {energy,edges,hop}=frames,n=energy.length;
 if(n<20)return [];
 const flux=new Float32Array(n);
 const smooth=new Float32Array(n);
 let running=0;
 for(let i=0;i<n;i++){
  running=running*.86+energy[i]*.14;smooth[i]=running;
  const past=Math.max(0,i-2);
  const attack=Math.max(0,energy[i]-energy[past]);
  const change=Math.max(0,edges[i]-edges[past]);
  flux[i]=attack+change*.65;
 }
 const medianFlux=percentile(flux,.72);
 const strongFlux=percentile(flux,.92);
 const noise=percentile(energy,.22);
 const minFlux=Math.max(0.000025,medianFlux*.72,strongFlux*.18);
 const minSpacing=Math.max(2,Math.round(.15/hop));
 const list=[];
 for(let i=3;i<n-2;i++){
  const f=flux[i];
  if(f<minFlux||f<flux[i-1]||f<flux[i+1])continue;
  if(energy[i]<Math.max(.0003,noise*1.65))continue;
  const local=energy[i]/Math.max(.001,smooth[i]);
  if(local<.92&&f<minFlux*1.8)continue;
  const t=i*hop;
  const strength=clamp(f/(strongFlux+.00001),.1,3);
  if(list.length&&i-list[list.length-1].frame<minSpacing){
   if(f>list[list.length-1].flux)list[list.length-1]={time:t,frame:i,flux:f,strength};
  }else list.push({time:t,frame:i,flux:f,strength});
 }
 return list;
}
function fingerprint(frames,onsets,start,{span=4.8,bins=20}={}){
 const events=onsets.filter(o=>o.time>=start&&o.time<start+span);
 if(events.length<3)return null;
 const rhythm=new Float32Array(bins),texture=new Float32Array(bins);
 let total=0;
 for(const event of events){
  const x=(event.time-start)/span*bins,ix=Math.floor(x);
  for(let di=-1;di<=1;di++){
   const k=ix+di;
   if(k>=0&&k<bins)rhythm[k]+=Math.max(.4,Math.min(1.3,event.strength))*(di===0?1:.35);
  }
 }
 for(let i=0;i<bins;i++){
  const begin=Math.floor((start+i*span/bins)/frames.hop);
  const end=Math.min(frames.energy.length,Math.ceil((start+(i+1)*span/bins)/frames.hop));
  let avg=0,c=0;
  for(let j=Math.max(0,begin);j<end;j++){avg+=frames.energy[j];c++}
  texture[i]=avg/Math.max(1,c);total+=texture[i];
 }
 const mean=total/bins;
 if(mean<.0005)return null;
 // Normalize absolute playing volume while retaining dynamic/phrase shape.
 for(let i=0;i<bins;i++)texture[i]=clamp(texture[i]/(mean+.000001),0,3);
 let norm=0;
 for(let i=0;i<bins;i++)norm+=rhythm[i]*rhythm[i];
 if(norm<.01)return null;
 const scale=1/Math.sqrt(norm);
 for(let i=0;i<bins;i++)rhythm[i]*=scale;
 return {start,end:start+span,count:events.length,rhythm:Array.from(rhythm),texture:Array.from(texture),mean};
}
function cosine(a,b){
 let dot=0,an=0,bn=0;
 for(let i=0;i<a.length;i++){dot+=a[i]*b[i];an+=a[i]*a[i];bn+=b[i]*b[i]}
 return dot/(Math.sqrt(an*bn)+1e-10);
}
function compare(a,b){
 if(!a||!b)return 0;
 const density=Math.min(a.count,b.count)/Math.max(a.count,b.count,1);
 if(density<.47)return 0;
 // Small displacement compensates for performance tempo/rubato (± one onset bin).
 let rhythmic=0;
 for(const shift of [-1,0,1]){
  const moved=b.rhythm.map((_,i)=>b.rhythm[i-shift]||0);
  rhythmic=Math.max(rhythmic,cosine(a.rhythm,moved));
 }
 // Center the energy contour. Flat loudness should not create a false match.
 const aa=a.texture.map(v=>v-1),bb=b.texture.map(v=>v-1);
 const dynamics=clamp((cosine(aa,bb)+1)/2,0,1);
 const similarity=.64*rhythmic+.36*dynamics;
 return clamp(similarity*(.78+.22*density),0,1);
}
function makeWindows(frames,onsets,{span=4.8,spacing=1.75,maxCandidates=520}={}){
 const windows=[];let previous=-Infinity;
 for(const onset of onsets){
  const t=onset.time;
  if(t-previous<spacing||t+span>=frames.duration)continue;
  const f=fingerprint(frames,onsets,t,{span});
  if(!f)continue;
  windows.push(f);previous=t;
  if(windows.length>=maxCandidates)break;
 }
 return windows;
}
function discover(windows,{minSeparation=25,maxMatches=12,minSimilarity=.59}={}){
 const candidates=[],scores=[];
 for(let i=0;i<windows.length;i++){
  const a=windows[i];
  for(let j=i+1;j<windows.length;j++){
   const b=windows[j];
   if(b.start-a.start<minSeparation)continue;
   const score=compare(a,b);
   if(score>0)scores.push(score);
   if(score>=minSimilarity)candidates.push({a:a.start,b:b.start,score,counts:[a.count,b.count],window:Math.min(a.end-a.start,b.end-b.start)});
  }
 }
 // Compare a candidate with this recording's own background similarity distribution.
 // A percentile is a relative rank, never a probability of the same musical idea.
 const floor=Math.max(minSimilarity,percentile(scores,.97));
 const sorted=scores.sort((a,b)=>a-b);
 function rank(value){let lo=0,hi=sorted.length;while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<value)lo=mid+1;else hi=mid}return sorted.length?lo/sorted.length:0}
 candidates.sort((x,y)=>y.score-x.score);
 const selected=[];
 for(const candidate of candidates){
  if(selected.length>=maxMatches)break;
  if(candidate.score<floor)break;
  // Avoid repeated overlapping suggestions dominating the same short time region.
  if(selected.some(p=>Math.abs(p.a-candidate.a)<9||Math.abs(p.b-candidate.b)<9||
    (Math.abs(p.a-candidate.b)<9&&Math.abs(p.b-candidate.a)<9)))continue;
  selected.push({...candidate,rankPercentile:rank(candidate.score),id:'m'+selected.length+'-'+Math.round(candidate.a*10)+'-'+Math.round(candidate.b*10)});
 }
 return selected;
}
function overview(frames,{points=144}={}){
 const values=[];
 for(let k=0;k<points;k++){
  const start=Math.floor(k*frames.energy.length/points);
  const end=Math.min(frames.energy.length,Math.ceil((k+1)*frames.energy.length/points));
  let peak=0;for(let i=start;i<end;i++)peak=Math.max(peak,frames.energy[i]);
  values.push(peak);
 }
 const max=percentile(values,.95)||.0001;
 return values.map(v=>clamp(v/max,0,1));
}
function analyze(buffer,options={}){
 const frames=featureFrames(buffer);
 const onsets=detectOnsets(frames);
 const windows=makeWindows(frames,onsets,options);
 const matches=discover(windows,options);
 return {duration:frames.duration,onsets:onsets.length,attacks:onsets.map(x=>({time:x.time,strength:x.strength})),windows:windows.length,matches,overview:overview(frames),span:4.8,method:'rhythm-and-energy-candidates-v2'};
}
return Object.freeze({featureFrames,detectOnsets,fingerprint,cosine,compare,makeWindows,discover,overview,analyze});
});