import React, { useMemo } from 'react';
import { alignedTime, clamp } from '../lib/phraseRanges.mjs';

function pointsFor(analysis, comparison, lane, normalized) {
  if (!analysis) return [];
  const good = analysis.pitch_frames.filter(f => f.voiced && f.hz > 0 && f.confidence >= .45);
  if (good.length < 2) return [];
  const median = [...good.map(x => x.hz)].sort((a,b)=>a-b)[Math.floor(good.length/2)];
  const paths = [];
  let current = [];
  let previous = null;
  for (const f of analysis.pitch_frames) {
    const valid = f.voiced && f.hz > 0 && f.confidence >= .45;
    const x = alignedTime(f.t_s, analysis.source.duration_s, comparison, lane, normalized);
    if (!valid || x < 0 || x > 1 || (previous !== null && f.t_s - previous > .13)) {
      if (current.length > 1) paths.push(current.join(' '));
      current = [];
      previous = null;
      if (!valid || x < 0 || x > 1) continue;
    }
    const relative = 12 * Math.log2(f.hz / median);
    current.push(`${(18 + clamp(x,0,1)*924).toFixed(2)},${clamp(78 - relative*5,14,136).toFixed(2)}`);
    previous = f.t_s;
  }
  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

function Lane({ label, analysis, comparison, lane, normalized, tone }) {
  const paths = useMemo(() => pointsFor(analysis, comparison, lane, normalized), [analysis, comparison, lane, normalized]);
  return <section className="mirror-lane">
    <div className="contour-head"><strong>{label}</strong><span>{analysis.source.duration_s.toFixed(2)}s analyzed · {analysis.onsets.length} attacks</span></div>
    <svg role="img" aria-label={label + ' relative pitch. Disconnected paths represent silent or uncertain pitches.'} viewBox="0 0 960 150" className="contour-svg">
      {[30,78,124].map(y=><line key={y} x1="18" y1={y} x2="942" y2={y} stroke="#4a463e"/>)}
      {analysis.rests.map((rest,i)=>{
        const x1=alignedTime(rest.start_s, analysis.source.duration_s, comparison, lane, normalized);
        const x2=alignedTime(rest.end_s, analysis.source.duration_s, comparison, lane, normalized);
        return <rect key={i} x={18+clamp(x1,0,1)*924} y="12" width={Math.max(0,(clamp(x2,0,1)-clamp(x1,0,1))*924)} height="123" fill="#9cb3a3" opacity=".12"/>;
      })}
      {analysis.onsets.map((onset,i)=>{
        const x=alignedTime(onset.t_s,analysis.source.duration_s,comparison,lane,normalized);
        return x<0||x>1?null:<line key={i} x1={18+x*924} x2={18+x*924} y1="132" y2={132-(onset.strength*25)} stroke="#a5bfae" strokeWidth="2"/>;
      })}
      {paths.map((points,i)=><polyline key={i} points={points} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}
    </svg>
    <p className="caption">{paths.length ? 'Pitch movement relative to the median of this recording; unvoiced frames omitted.' : 'Insufficient reliable pitch frames to plot this lane.'}</p>
  </section>;
}

export default function MirrorCompare({ reference, take, comparison, normalized, onNormalize }) {
  if (!reference?.analysis || !take?.analysis) return null;
  return <section className="mirror-comparison" aria-label="Musical comparison">
    <div className="compare-head">
      <div><p className="eyebrow">03 / MIRROR</p><h2>Two phrases. Their own time.</h2></div>
      <label className="toggle-row"><input type="checkbox" checked={normalized} onChange={e=>onNormalize(e.target.checked)} /> Align the shapes</label>
    </div>
    <p className="hint">{normalized ? 'Normalized display only: matched attack spans line up visually. Audio files retain their original tempo.' : 'Analyzed excerpt time: each lane uses its own extracted duration. Original recordings are preserved. This is not an accuracy score.'}</p>
    <Lane label="Reference" analysis={reference.analysis} comparison={comparison} lane="reference" normalized={normalized} tone="#d5a27e"/>
    <Lane label="Your take" analysis={take.analysis} comparison={comparison} lane="take" normalized={normalized} tone="#9dc7b2"/>
    <div className="compare-notes">
      <p>{comparison ? `${comparison.matched_onsets.length} temporally corresponding attacks in the selected excerpt · ${comparison.unmatched_take_indices.length} unmatched attacks in your take (timing only; not proof of the same notes).` : 'Run Compare to find correspondences; visualization still shows both original phrases.'}</p>
      {(comparison?.descriptors||[]).map((desc,i)=><p key={i}>{desc}</p>)}
      {(comparison?.warnings||[]).map((w,i)=><p key={i} className="warning">{w}</p>)}
    </div>
  </section>;
}
