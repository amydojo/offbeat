import React, { useEffect, useRef, useState } from 'react';

// A non-destructive navigator for finding the *part* of a long reference track
// that the performer remembers. The selected times stay in the original source.
export default function ExcerptPicker({ clip, start, length, maxStart, onChange, onError }) {
  const player = useRef(null);
  const [playing, setPlaying] = useState(false);
  const stop = () => {
    player.current?.pause();
    setPlaying(false);
  };
  useEffect(() => { stop(); }, [clip?.url, start, length]);
  useEffect(() => () => {
    if (player.current) {
      player.current.pause();
      player.current.removeAttribute('src');
      player.current.load();
    }
  }, []);

  const preview = async () => {
    const audio = player.current;
    if (!audio) return;
    if (playing) { stop(); return; }
    audio.pause();
    try {
      // A newly uploaded M4A/WebM/WAV may not have metadata decoded yet.
      // Seeking before metadata is ready can leave the preview idle.
      if (audio.readyState < 1) {
        await new Promise((resolve, reject) => {
          const cleanup = () => {
            audio.removeEventListener('loadedmetadata', loaded);
            audio.removeEventListener('error', failed);
          };
          const loaded = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error('Audio metadata unavailable.')); };
          audio.addEventListener('loadedmetadata', loaded, { once: true });
          audio.addEventListener('error', failed, { once: true });
          audio.load();
        });
      }
      audio.currentTime = start;
      // Show that playback was requested immediately; onPause/onEnded
      // and the catch path still clear the state if it cannot continue.
      setPlaying(true);
      await audio.play();
    } catch {
      setPlaying(false);
      onError('Could not preview this section. Try the reference audio player above.');
    }
  };
  const startLabel = start.toFixed(2);
  const endLabel = (start + length).toFixed(2);
  return <section className="excerpt-picker" aria-label="Choose a reference excerpt">
    <p className="eyebrow">FIND THE MOMENT IN THE REFERENCE</p>
    <p className="hint">Choose which {length.toFixed(1)}-second part of the reference to compare with your take. Full songs are never force-aligned to a short hum.</p>
    <div className="excerpt-controls">
      <label htmlFor="excerpt-start">Reference excerpt · {startLabel}s–{endLabel}s
        <input id="excerpt-start" aria-label="Reference excerpt position" type="range"
          min="0" max={Math.max(maxStart, .001)} step=".1"
          value={start} disabled={maxStart <= 0}
          onChange={e => onChange(Number(e.target.value))}/>
      </label>
      <button className="button-quiet" type="button" onClick={preview}>
        {playing ? '■ Stop preview' : '▶ Preview excerpt'}
      </button>
    </div>
    <audio ref={player} src={clip.url} preload="metadata" aria-hidden="true"
      onEnded={()=>setPlaying(false)}
      onPause={()=>setPlaying(false)}
      onTimeUpdate={e=>{
        if (e.currentTarget.currentTime >= start + length) stop();
      }}/>
  </section>;
}
