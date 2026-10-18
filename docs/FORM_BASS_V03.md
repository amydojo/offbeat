# FORM 003 — Bass Drawing / Sound and Gesture
**Status:** Committed to OFFBEAT `/instrument/`. Production build and automated frontend tests required; real iPhone listening evaluation remains outstanding.

## Problem
FORM 002's melodic oscillator sounded like a kazoo: sustained prominent harmonic oscillator at an unnaturally high brightness over a low fundamental, with neither note attack nor natural decay. Pitch drawing was a continuous glide, which made simple bass riffs harder to phrase.

## What changed
- `public/instrument/bass-v3.js`: new isolated Web Audio bass voice module with a sine fundamental, quieter upper partial, gentle lowpass filtering, light soft saturation, plucked amplitude envelope and **faster harmonic decay**. The pitch range now favors actual bass registers (roughly 65–196 Hz with deliberate higher harmonics for phone audibility).
- **RIFF** is the default touch control mode. Finger height chooses from eight ascending D-minor-pentatonic pitches (D2–G3) with small hysteresis to avoid boundary jitter but no forced timer that could lose the last note of a fast slide. As the player crosses into a new note lane the instrument articulates another pluck. The dotted guide line indicates the current note lane without displaying notation.
- **GLIDE** preserves the original continuous pitch-bending mode with a bass timbre and no forced scale mapping. Switching requires lifting the melody finger to prevent a new mode from interrupting a held note.
- WARM and EDGE remain available but both are bass voices now, not a kazoo lead. Horizontal finger position controls brightness.
- Capture now saves format v3 with the selected gesture mode. v1/v2 captures continue to replay in legacy GLIDE behavior, without rewrites. All drum hits and POCKET processing remain untouched. Replay and offline WAV use the same new synth as live audio.

## Engineering requirements
- Audio context still unlocks from explicit user tap. The notes and drums continue to use one shared compressor/master output.
- `public/instrument/bass-v3.js` loads before inline FORM script and holds synthesis logic independently from UI.
- Stop and CUT retain short releases; STOP REPLAY silences the dedicated playback bus.
- Low CPU overhead, no cloud service or pretrained models.
- All live touch playing stays unquantized in time. Pitched `RIFF` snapping affects only pitch choice and musical articulation; RAW event coordinates remain recorded.

## QA
- `scripts/form_bass.test.cjs` verifies ascending pitch lanes, timbre creation, harmonic decay scheduling, sensitivity to intentional movements, lack of tremble-induced retriggers, GLIDE freedom, cleanup, future-time offline rendering, and local format compatibility.
- Existing `scripts/form_rhythm.test.cjs` guards drums and rhythm assistance.
- CI runs both, then Vite build. Passing code tests alone cannot establish perceived bass sound on physical iPhone speakers; get listening feedback.

## Next evaluation
On real device compare WARM / RIFF (default), EDGE / RIFF, WARM / GLIDE against the KICK/SNARE/HAT drummer. Listen for audible low note identity, too many accidental retriggers, and harshness on lower phone-speaker notes. If weak, adapt harmonic audibility before adding features.
