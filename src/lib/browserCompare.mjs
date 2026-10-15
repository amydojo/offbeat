// Browser-only comparison uses existing source timelines; no audio upload.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function median(a){const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];}
function gesture(frames){
 const clean=frames.filter(f=>f.voiced&&f.hz>0&&f.confidence>=.45);
 if(clean.length<8)return null;
 const n=Math.max(2,Math.floor(clean.length/3));
 const diff=12*Math.log2(median(clean.slice(-n).map(f=>f.hz))/median(clean.slice(0,n).map(f=>f.hz)));
 return diff>1.6?'rises':diff< -1.6?'falls':'holds';
}
export function compareLocal(reference,take,{referenceRegion,mode='onsets'}={}){
 for(const p of [reference,take]){
  if(p?.schema_version!=='offbeat.phrase.v1'||!finite(p.source?.duration_s))throw Error('Analyze both recordings before comparing.');
 }
 const duration=reference.source.duration_s,td=take.source.duration_s;
 const start=referenceRegion?.start_s??0,end=referenceRegion?.end_s??duration;
 if(!finite(start)||!finite(end)||start<0||end>duration+.001||end-start<.2)throw Error('Choose a valid reference excerpt.');
 const subset={
  onsets:reference.onsets.filter(x=>x.t_s>=start&&x.t_s<=end),
  pitch_frames:reference.pitch_frames.filter(x=>x.t_s>=start&&x.t_s<=end),
  rests:reference.rests.filter(x=>x.start_s<end&&x.end_s>start)
 };
 function anchors(arr,a,b){
  const good=arr.filter(o=>o.strength>=.2);
  return mode==='onsets'&&good.length>=2&&good.at(-1).t_s-good[0].t_s>=(b-a)*.5
   ?[good[0].t_s,good.at(-1).t_s,'onset_span']:[a,b,'duration'];
 }
 const [r0,r1,rm]=anchors(subset.onsets,start,end),[t0,t1,tm]=anchors(take.onsets,0,td);
 const ratio=(r1-r0)/(t1-t0);
 if(ratio<.5||ratio>2)throw Error('The excerpts differ too much in length; choose another reference section.');
 const used=new Set(),matches=[],missing=[],tol=Math.max(.09,Math.min(.24,(r1-r0)*.045));
 subset.onsets.forEach((r,i)=>{
  const expected=t0+(r.t_s-r0)/ratio;let best=-1,error=Infinity;
  take.onsets.forEach((t,j)=>{if(used.has(j))return;const diff=Math.abs((t.t_s-expected)*ratio);if(diff<error){error=diff;best=j;}});
  if(best<0||error>tol){missing.push(i);return;}
  used.add(best);
  matches.push({reference_index:i,take_index:best,reference_time_s:r.t_s,take_time_s:take.onsets[best].t_s,offset_on_reference_seconds:+((take.onsets[best].t_s-expected)*ratio).toFixed(4)});
 });
 const refShape=gesture(subset.pitch_frames),takeShape=gesture(take.pitch_frames);
 const descriptors=[];
 if(refShape&&takeShape){
  if(refShape===takeShape)descriptors.push(refShape==='holds'?'Both phrases stay near their starting registers.':refShape==='rises'?'Both phrases rise.':'Both phrases fall.');
  else descriptors.push('The reference '+refShape+'; your take '+takeShape+'.');
 }
 if(subset.rests.length&&take.rests.length)descriptors.push('Both recordings contain spaces between gestures.');
 if(!descriptors.length)descriptors.push('Try a clearer pitched phrase for a meaningful comparison.');
 const warnings=['Matched attacks mean nearby timings, not proof of identical notes or the same riff.','On-device pitch confidence is uncalibrated.'];
 if(!refShape||!takeShape)warnings.push('One recording has too little reliable pitch to compare contour.');
 return {
  schema_version:'offbeat.compare.v1',reference_analysis_id:reference.analysis_id,take_analysis_id:take.analysis_id,
  alignment:{mode,method:rm===tm?rm:'mixed_span_fallback',reference_region_start_s:start,reference_region_end_s:end,reference_anchor_start_s:r0,reference_anchor_end_s:r1,take_anchor_start_s:t0,take_anchor_end_s:t1,take_to_reference_scale:+ratio.toFixed(6),reference_duration_s:duration,take_duration_s:td},
  matched_onsets:matches,unmatched_reference_indices:missing,unmatched_take_indices:take.onsets.map((_,i)=>i).filter(i=>!used.has(i)),
  coverage:{reference_voiced_fraction:+(subset.pitch_frames.filter(f=>f.voiced).length/Math.max(1,subset.pitch_frames.length)).toFixed(4),take_voiced_fraction:+(take.pitch_frames.filter(f=>f.voiced).length/Math.max(1,take.pitch_frames.length)).toFixed(4)},
  descriptors,warnings
 };
}
