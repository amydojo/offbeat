import React, { useEffect, useRef, useState } from 'react';
import { selectionForLane } from '../lib/phraseRanges.mjs';

const FADE_S = .03;

// Two independent HTML media decoders, one audible lane at a time.
// Browser owns scheduling; server is not called during playback.
export default function PhrasePlayer({ reference, take, comparison, selection, takeLabel='Your take', referenceLabel='Reference' }) {
  const players = useRef({});
  const running = useRef(null);
  const raf = useRef(null);
  const [mode, setMode] = useState('stopped');
  const [repeat, setRepeat] = useState(false);
  const repeatRef = useRef(false);
  repeatRef.current = repeat;
  const [error, setError] = useState('');
  const [position, setPosition] = useState('');

  function stop() {
    running.current = null;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    Object.values(players.current).forEach(p => {
      p.pause();
      p.volume = 1;
    });
    setMode('stopped');
    setPosition('');
  }

  useEffect(() => {
    const old = players.current;
    const next = {};
    if (reference?.url) { next.reference = new Audio(reference.url); next.reference.preload = 'auto'; }
    if (take?.url) { next.take = new Audio(take.url); next.take.preload = 'auto'; }
    players.current = next;
    return () => {
      running.current = null;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      Object.values(next).forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); });
      // Only these owned players are disposed; replacing a take cannot stop external
      // Tone.js demo loops, and an unmount cannot retain a stale blob URL.
      if (players.current === next) players.current = {};
      Object.values(old).forEach(a => a.pause());
    };
  }, [reference?.url, take?.url]);

  useEffect(() => { stop(); }, [reference?.url, take?.url, reference?.excerptStart, take?.excerptStart,
    reference?.analysis?.analysis_id, take?.analysis?.analysis_id, comparison, selection.start, selection.end]);

  const range = lane => selectionForLane(
    selection, comparison, lane,
    reference?.analysis?.source.duration_s || take?.analysis?.source.duration_s || 1,
    take?.analysis?.source.duration_s || 1,
  );

  async function begin(nextMode) {
    stop();
    setError('');
    if (!reference?.analysis || !take?.analysis) return;
    const token = { mode: nextMode, lane: nextMode === 'reference' ? 'reference' : 'take' };
    running.current = token;
    setMode(nextMode);

    const playLane = async lane => {
      if (running.current !== token) return;
      token.lane = lane;
      const audio = players.current[lane];
      if (!audio) { stop(); return; }
      const segment = range(lane);
      const sourceStart=(lane==='reference'?reference:take)?.excerptStart||0;
      const absolute={start:segment.start+sourceStart,end:segment.end+sourceStart};
      Object.values(players.current).forEach(a => { if (a !== audio) a.pause(); });
      try {
        audio.pause();
        audio.playbackRate = 1;
        audio.currentTime = absolute.start;
        audio.volume = 0;
        await audio.play();
      } catch (e) {
        if (running.current === token) { setError('Playback was blocked. Press Play again or check the recording format.'); stop(); }
        return;
      }
      if (running.current !== token) { audio.pause(); return; }

      const tick = () => {
        if (running.current !== token) return;
        const current = audio.currentTime;
        // Apply non-destructive edge ramps. No audio data is resampled or quantized.
        const fadeIn = (current - absolute.start) / FADE_S;
        const fadeOut = (absolute.end - current) / FADE_S;
        audio.volume = Math.max(0, Math.min(1, fadeIn, fadeOut));
        setPosition(`${lane === 'reference' ? referenceLabel : takeLabel} · ${current.toFixed(2)}s`);
        if (current >= absolute.end - .01 || audio.ended) {
          audio.pause();
          audio.volume = 1;
          if (nextMode === 'alternate' && lane === 'take') {
            void playLane('reference');
          } else if (repeatRef.current) {
            void playLane(nextMode === 'alternate' ? 'take' : lane);
          } else stop();
        } else {
          raf.current = requestAnimationFrame(tick);
        }
      };
      raf.current = requestAnimationFrame(tick);
    };
    await playLane(token.lane);
  }

  const ready = !!reference?.analysis && !!take?.analysis;
  return <section className="player quick-player" aria-label="Phrase audition">
    <div className="transport" role="group" aria-label="Phrase playback">
      <button className="button-record play-ab" onClick={()=>begin('alternate')} disabled={!ready} aria-pressed={mode==='alternate'}>
        {mode==='alternate'?'▶ Playing A → B':'▶ Play A / B'}</button>
      <button className="button-quiet" onClick={()=>begin('take')} disabled={!ready} aria-pressed={mode==='take'}>A · {takeLabel}</button>
      <button className="button-quiet" onClick={()=>begin('reference')} disabled={!ready} aria-pressed={mode==='reference'}>B · {referenceLabel}</button>
      <button className="button-quiet" onClick={stop} disabled={mode==='stopped'}>■ Stop</button>
    </div>
    <div className="player-meta">
      <p className="caption" role="status">{error||position||(ready?'A plays first, then B. Neither recording is changed.':'Analyze both clips to compare them.')}</p>
      <label className="toggle-row"><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> Loop A/B</label>
    </div>
  </section>;
}
