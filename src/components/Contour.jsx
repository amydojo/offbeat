import React, { useMemo } from 'react';

function trace(data, duration) {
  const frames = data?.pitch_frames || [];
  const voiced = frames.filter((f) => f.voiced && Number.isFinite(f.hz) && f.hz > 0);
  if (!voiced.length) return { paths: [], label: 'No reliable pitch contour detected.' };
  const ordered = [...voiced.map((f) => f.hz)].sort((a, b) => a - b);
  const anchor = ordered[Math.floor(ordered.length / 2)];
  const paths = [];
  let points = [];
  let previous = null;
  for (const frame of frames) {
    const valid = frame.voiced && Number.isFinite(frame.hz) && frame.hz > 0 && frame.confidence >= 0.45;
    if (!valid) {
      if (points.length > 1) paths.push(points.join(' '));
      points = [];
      previous = null;
      continue;
    }
    // Break at detected gaps; never connect across unvoiced or missing data.
    if (previous !== null && frame.t_s - previous > 0.13) {
      if (points.length > 1) paths.push(points.join(' '));
      points = [];
    }
    const x = 18 + (frame.t_s / duration) * 924;
    const semitones = 12 * Math.log2(frame.hz / anchor);
    const y = Math.max(18, Math.min(132, 74 - semitones * 5));
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    previous = frame.t_s;
  }
  if (points.length > 1) paths.push(points.join(' '));
  return { paths, label: paths.length ? 'Relative pitch movement. Gaps mean unreliable or silent pitch.' : 'Insufficient stable pitched frames.' };
}

export default function Contour({ analysis, label }) {
  const duration = Math.max(analysis.source.duration_s, 0.001);
  const plotted = useMemo(() => trace(analysis, duration), [analysis, duration]);
  return (
    <section className="contour" aria-label={label + ' musical features'}>
      <div className="contour-head"><strong>{label}</strong><span>{duration.toFixed(1)} s · {analysis.onsets.length} detected attacks</span></div>
      <svg viewBox="0 0 960 150" role="img" aria-label={plotted.label} className="contour-svg">
        {[30, 74, 118].map((y) => <line key={y} x1="18" x2="942" y1={y} y2={y} stroke="#504c46" strokeWidth="1" />)}
        {analysis.rests.map((rest, i) => (
          <rect key={i} x={18 + rest.start_s / duration * 924} width={Math.max(0, (rest.end_s - rest.start_s) / duration * 924)} y="15" height="120" fill="#a3b9a4" opacity=".09" />
        ))}
        {analysis.onsets.map((onset, i) => (
          <line key={i} x1={18 + onset.t_s / duration * 924} x2={18 + onset.t_s / duration * 924} y1="127" y2={127 - onset.strength * 18} stroke="#a5bfae" strokeWidth="2" />
        ))}
        {plotted.paths.map((path, i) => <polyline key={i} points={path} fill="none" stroke="#e4a37c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <p className="caption">{plotted.label}</p>
      {analysis.warnings?.length > 0 && <p className="caption warning">{analysis.warnings.join(' · ')}</p>}
    </section>
  );
}
