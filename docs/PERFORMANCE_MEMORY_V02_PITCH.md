# OFFBEAT / Performance Memory V2 — Rhythm + Bass Pitch

## What is actually live
Same route: `/performance-memory/`. The interface still imports a recording on the device and retains the existing glowy source-timeline constellation and A/B source playback.

**New second stage:** after the rhythm/energy analyzer finds plausible candidate pairs, an on-device YIN-style pitch detector checks up to 12 short source pairs. It measures probable low-bass fundamentals (36–390 Hz), pitch confidence, and octave-risk. Relative contour comparison is transposition invariant; a reversed contour lowers similarity even when the underlying rhythm is identical.

The selected candidate displays two thin melodic-contour traces:
- terracotta: the first occurrence
- muted green: the later occurrence

The caption distinguishes similar, related or different movement and warns about octave ambiguity. If too few reliable notes exist, the melodic comparison is withheld. Do not misrepresent a missing comparison as no similarity.

## Data model
- `phrase-core.js`: attack/onset candidate times and rhythm/energy fingerprints.
- `pitch-core.js`: YIN-like CMNDF pitch extraction around onsets, octave-risk flag, confidence-gated note events, transposition-invariant contour comparison. Does **not** use torchcrepe.
- `app.js`: combined-score re-ranking of candidates with available pitch, plus concise contour visualization. A source pair can be rhythmically close and melodically different.
- The full audio remains in the browser; there is no HTTP upload, managed inference, audio storage or server API.

## Reference model pipeline
`tools/bass_pitch_reference.py` is a **standalone desktop/Python reference**, not a Vercel API:
```sh
pip install numpy librosa soundfile torch torchcrepe
python tools/bass_pitch_reference.py "Bass 4.m4a" --pair 94:196 -o analysis.json
```
- Default backend: torchcrepe-tiny (if installed), with periodicity gating at 0.55 and frequency bounds 36–390 Hz.
- Explicit YIN fallback: `--backend yin`. The fallback has **no calibrated periodicity confidence** and must be labeled accordingly.
- It extracts note timings with librosa, estimates fundamental frequency in candidate excerpts, compares pitch intervals rather than absolute note names, and emits structured JSON.
- This script does not auto-discover candidate pairs from an entire recording; it verifies the pairs supplied by OFFBEAT or a researcher via `--pair`/`--pairs-json`.
- Torchcrepe was unavailable in the current offline build environment; code integration exists but neural inference was **not** run or validated here. YIN fallback was executed against Bass 4.

## Validation
- Automated JavaScript tests: 18 tests (including low E1 ≈ 41.2 Hz, a transposed phrase, reversed direction, silent recording and insufficient note confidence). A stricter synthetic similarity assertion was calibrated without removing the octave-risk penalty.
- Original Performance Memory and Evolve tests remain build-blocking in `npm run test`.
- The YIN fallback on a Bass 4 pair near 1:34 and 3:16 detected note events in both excerpts but weak shape similarity. This is **not** proof they are different riffs: percussion/recording artifacts and octave errors remain possible.
- Vercel production READY is not equivalent to tested iPhone Safari playback or test of the optional Python neural path.

## MERIT research boundary
MERIT uses MERT-v1-330M plus trained heads to compare melody/rhythm/timbre. It is not loaded in the iPhone application because the backbone is large and would damage load/performance. The MERIT head release is MIT, but the backbone `m-a-p/MERT-v1-330M` is CC BY-NC 4.0; do a licensing review before commercial deployment.

## Next high-value evolution
Evaluate performance recordings using a hand-confirmed set of positive/negative phrase pairs. Track separate pitch reliability, rhythmic recurrence and note-onset quality. Only consider MERIT if it improves judged retrieval precision. Later support verified source-clip → original riff seed; do not produce MIDI or notes from uncertain pitches.
