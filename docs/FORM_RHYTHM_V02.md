# FORM 002 — Rhythm Partner / Instinct-First Performance

Status: Production code deployed under /instrument/. Physical-iPhone QA remains required.

## Intent
FORM previously offered just one pitched rhythmic trigger. The upgraded instrument separates expressive melody from kick/snare/hat playing, so the player can find rhythms by touch without note names or theory drills.

## Controls
- Melody surface: continuous pitch / timbre, raw gesture timing.
- KICK / SNARE / HAT: independent drum voices and touch-position intensity. Hits are immediate, never delayed for correction.
- CUT: mutes the held melody; independent drums remain active.
- DRUMS OFF / FOLLOW / FILL: compact adaptive browser drummer. FOLLOW is sparse; FILL adds counter-rhythm when there is room.
- POCKET RAW / SOFT / TIGHT: optional gentle timing assistance only for replay and WAV export. Live playing always remains unquantized.

## Engine
- Built entirely on-device with Web Audio. Synthesized procedural drum voices use reusable seeded noise buffers and short kick frequency envelopes.
- A guarded tempo estimator considers intervals and subdivisions among recent manual taps with an approximate continuity prior. Pulse is uncertain and can confuse half/double time; this is **not** a pretrained AI model or a reliable musical-intent classifier.
- Accompaniment schedules ahead a short window, and manual hits suppress nearby duplicate automated drum voices where scheduling allows.
- FILL varies with density of recent human hits, leaving more space when the player is busy.
- POCKET shifts manual drum events conservatively and, for melody, shifts entire pitch-bend gesture segments together rather than destroying contours. RAW events are never rewritten.
- Live generated hits captured during RECORD are stored with an explicit generated flag. Offline WAV reuses the drum synthesizer.
- Save format v2 includes BPM, anchor and drum events; old v1 captures still load.

## Privacy, QA and limitations
- Audio remains browser-native and locally generated; no microphone access, backend, login or subscriptions are needed for FORM.
- Saved phrase uses localStorage on the current device/browser. WAV provides a portable copy; no automatic sync.
- Regression coverage: scripts/form_rhythm.test.cjs, run in existing CI frontend job, plus existing Vite build.
- Simulated integration checks exercised audio unlock, 3 drum pads, FOLLOW / FILL, pocket selection, recording and replay.
- Real iOS Safari tests and listening comparison remain outstanding. Drum sound is procedural, not a sampled pro drum kit.
- Next milestone: confidence-aware beat/half-time choices and human A/B studies before claiming meaningful musical-intent inference.
