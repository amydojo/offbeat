# FORM 004 — From pitch slider to touch-plucked bass

**Status:** Live code committed to `public/instrument/`; automated test results and iPhone listening should gate any claim of final musical quality.

## The insight
Changing triangle/sine oscillators did not solve the user's complaint because the *interaction model* remained a continuously sliding synthesizer. The new default changes what playing means: each gesture triggers a short bass-string event instead of sustaining an oscillator indefinitely.

## What changed
- Eight tactile note lanes in the central instrument. Tapping a lane excites a note, dragging across lanes strikes a sequence, and a deliberate sideways stroke re-plucks the same pitch. Finger position across the width is not constantly connected to frequency.
- Real one-shot string modeling (delay-line/plucked-string feedback) replaces the previous always-on oscillator. Fast attack, decay, distinct note boundaries, sine-less string-like timbre.
- Layered recording attacks reuse existing bass samples bundled with BASS MIRROR, all local to the browser. `bass-samples-v4.js` contains copied existing project assets, not third-party recordings.
- Default PLUCK with optional GLIDE switch. GLIDE remains available for improvised bends and legacy recordings.
- Sound choices are ROUND and BITE, affecting harmonic strength and transient brightness.
- Keep and replay now preserve explicit `pluck` events in schema v4. Files from versions 1–3 are still accepted. Legacy GLIDE and RIFF recordings use the older sound engine.
- The previously working rhythm-partner and drum pads remain unchanged. WAV export uses locally rendered plucked voices; samples are decoded before rendering.
- Gesture protection against accidental mobile zoom and scroll remains in effect.

## User-experience principle
The instrument needs to be playable with two thumbs without technical explanations. First touch should create a satisfying discrete note. Sweeps should create identifiable riffs rather than a kazoo-like pitch smear. UI shows physical string lines, not an XY-coordinate editor.

## Known limits
- Algorithmically synthesized bass is not yet indistinguishable from an actual amplifier/DI-recorded bass. The archived fragments may vary in quality and detected pitch; a waveguide note remains the stable pitch anchor.
- iOS audio unlock is still required.
- No trained AI or actual musical-intent model is used.
- Personal listening and real iPhone friction testing remain essential.

## Quality gate
- `scripts/form_pluck.test.cjs`: audible nonzero wave buffer, no continuously running oscillators, 8 notes, cached buffers, embedded sample bank, v4 capture.
- `scripts/form_browser_smoke.py`: Chromium mobile test of offline audio RMS/peak/decay, unlock, PLUCK↔GLIDE, capture and replay.
- Existing `form_bass.test.cjs` and `form_rhythm.test.cjs` run in CI, as does general OFFBEAT smoke testing.
