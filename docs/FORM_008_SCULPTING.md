# FORM 008 — Responsive sculpting + musical causality
**Implemented:** October 18, 2026
**Route:** `/instrument/frame/`. Existing FORM 006 instrument remains intact. All Web Audio is on-device and sample attribution retained.

## Why this iteration exists
The user found Groove Frame 007 musical and satisfying, but reported three usability issues: point editing feels rigid; it is difficult to identify which parts changed; and the full five-second original-versus-variation loop takes too long to hear small differences.

## Built
- **Elastic gesture field:** `deformFrame(frame,id,height)` in `core.mjs` changes the selected bass event and locally displaces neighboring authored heights using a deterministic Gaussian falloff (max neighboring weight .34). Its source frame, note IDs, timings and rests remain intact; one pointer gesture commits exactly one undoable change.
- **Live sampled sound under the finger:** `FrameAudio.sculpt` creates a recorded-bass GLIDE through a separate preview bus while the finger moves. Moving pitch is smoothly bent; the ongoing arrangement ducks a little during the interaction. Release ends the solo voice and smoothly restores the mix. No new model/API.
- **Tactile deformation visualization:** main contour becomes a ribbon of translucent material separating previous and current shapes; affected points have short causal links; dependent harmonic nodes brighten. The original is not overwritten.
- **Change evidence:** `WHAT MOVED` uses actual compiled render differences, not fake animation. It identifies bass pitch direction and rough semitone shift, harmonic response, and whether the generated drum accent changed or the pulse stayed intact.
- **Focused audible A/B:** `BEFORE / AFTER` triggers a quick pair of solo bass-and-harmony snippets ~.76 seconds apart, dynamically ducking the background groove; the loop transport and authored frame are unchanged. A rest produces a genuine silence in that part of the comparison.
- **Playback truthfulness:** separate indicators `HEARING / ORIGINAL`, `HEARING / YOUR VERSION`, and `NEXT LOOP / ...` distinguish immediate sketch audition from a queued whole-groove update. The full arrangement still changes on the next rhythmic loop boundary, never mid-bar.
- **Paused editing:** the master output safely reopens after the stop tail, so standalone sculpt previews work with the loop paused.

## Interaction contract
First click START to unlock audio and hear the complete starter. Grab anywhere on the contour; the nearest bass gesture responds elastically and audibly. After release the user hears the changed bass and supporting harmony immediately, sees which relationships changed, and then hears the integrated variation on the next loop. One tap on BEFORE / AFTER auditions the affected moment without waiting through two full loops. Original comparison, undo, saved variations, constraints, and export remain available.

## QA
- `scripts/form_frame.test.cjs` exercises deterministic local deformation, original ownership, dependent harmony and untouched distant events.
- `scripts/form_frame_browser_smoke.py` asserts visible pending-versus-active playback state, new strip, browser A/B control, live sculpting gesture, old FORM regressions, local variation restoration, and exported WAV.
- `node --check` guards browser-only ES modules.

## Remaining limitations
- The audible comparison is *the affected bass/harmony gesture*, not a fully mixed parallel two-bar A/B; this is intentional for identifying a small edit.
- Elastic influence is local and static-weighted, not a full physical simulation. The gesture remains a sequence of note intentions whose sounding pitches are mapped into the selected tonal palette at render time; the continuous sampled GLIDE is only the tactile audition layer.
- Music quality and tactile nuance on a real iPhone still need direct listening/feel testing, despite passing automated browser audio tests.
