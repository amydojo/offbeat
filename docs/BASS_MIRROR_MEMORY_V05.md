# OFFBEAT / MEMORY V5 — Constellation Architecture

## Product principle
The constellation is the primary instrument surface. It should convey musical relationships instantly, with detail on demand. Preserve mobile one-screen Play / Change / Edit / Keep and the V2 working bass audio.

## Implementation
- `public/bass-mirror/index.html` loads v2 audio → v3 pattern engine → v4 mobile dock → v5 constellation renderer in that order.
- `v5-constellation.js` owns **presentation only**. It reads `window.OFFBEAT_MEMORY_ENGINE.read()` and calls `propose/before/after/keep/discard`.
- `v3.js` owns 16-step pattern snapshots, repeat analysis, comparison, local saves, and the immutable bridge. Neither the renderer nor the mobile UI directly writes sequencer state.
- V2 maintains AudioContext decoding, phone-speaker harmonic support, bass sample playback and transport.
- The original timeline grid remains in mobile Edit; the constellation is a different view on the **same events**, never a duplicated sequence.

## Visual encoding (not arbitrary particles)
- Horizontal coordinate: exact step 0–15.
- Vertical coordinate: stable **sample identity/role**; not transcribed pitch.
- Warm connected path: chronologically ordered bass events.
- Bright nodes: repeated phrase placements; subtle nodes: other bass events.
- Elevated dashed arcs: a matching event of the **same sample ID** and **same local four-step offset** exactly 8 steps later (as computed by V3).
- Small dim satellites: found percussion/touch textures, kept subordinate to melody-like bass events.
- Dotted ghost branches: candidate A/B difference; tap the ghost to switch back to the other version.
- Sparse stable labels (LOW, PULSE, RISE, SPARK) and 01,05,09,13,16 tick landmarks make the organic map understandable without a panel of explanatory text.

## Musical decisions
**Try a branch** requests a valid single-event change from the existing V3 decision engine. The new path is visually distinct and audible via A/B controls. KEEP commits it to the underlying pattern; discard restores the earlier snapshot. The mobile Change sheet still exposes intent and protected sample.

## Limitations that must remain explicit
V5 draws musical patterns **in the reconstructed 16-step sample arrangement**. It does not claim that notes were transcribed, that pitches were recovered, or that recurring gestures were measured from full raw improvisations. Labels are sample names.

## Mobile UX constraints
- No separate boxes for every statistic. The memory scene, connected nodes, one-line hint and primary dock are the default interface.
- Secondary explanations remain in the mobile About sheet.
- Existing iOS audio path stays user-gesture initiated; do not replace direct touch with synthetic clicks or asynchronous unlock logic.
- Constellation paint is throttled ~20 fps idle / ~33 fps playing, lower rate with reduced motion. Device pixel ratio capped at 2.
- Tap nearest node within 23 CSS px; ghost node within 18 CSS px. Keyboard arrow/Enter support on the canvas and A/B buttons provide additional paths.
- Avoid uncontrolled blur: graph glow only around meaningful events, sharp main line and minimal subdued percussion.
- Do not destroy original audio buffers or add remote analytics calls.

## Validation
- V3 and V5 scripts passed JavaScript syntax compilation.
- Vercel production deployment READY and linked to the intended `amydojo/offbeat` repository.
- Live iPhone Safari audio/visual QA is still required; deployment readiness alone cannot prove canvas interaction or device playback.
- Follow-up QA: confirm Play, tap nodes, Change → compare A/B, tap dotted ghost, Keep, reopen saved version, switch Form/Frequency, and landscape/short-screen behavior.

## Next meaningful engineering milestone
Extract recurrence into an importable pure module with tests, then add **raw-performance phrase detection** (onsets + rhythmic fingerprints with confidence). Use user-auditioned source-excerpt pairs as ground truth before adding similarity embeddings. Do not confuse decorative visual coherence with statistically verified recognition.
