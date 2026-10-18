# OFFBEAT — BASS MIRROR V6 / MUSICAL EVOLUTION

## What shipped
An eight-bar structured arrangement from the same 16-step bass-sample pattern. The original groove is **preserved**, not replaced. The app can now give one idea a beginning, development, and return.

Bar plan:
1. FIND — original phrase
2. HOLD — exact repeat
3. ANSWER — one contrasting bass accent in an otherwise empty slot
4. BEND — move one unprotected event within its existing four-step phrase
5. SPACE — omit one unprotected note to create a rest
6. WANDER — one timing shift plus a subtle found percussion event
7. RECALL — a variation based on the answer
8. RETURN — mathematically exact original phrase

This is deterministic, sample-based composition. It is **not** AI transcription or recognition of notes in full raw improvisations.

## Architecture
- `public/bass-mirror/evolution-core.js` — pure (DOM/audio-free) function `compose(pattern)`. Normalizes 16-step events, chooses a bass anchor, constructs eight phase patterns and their bounded edits. `eventsAt(plan, absoluteStep)` emits `{id,velocity,step,bar}` for scheduled hits.
- `public/bass-mirror/evolution-ui.js` — runtime adapter with `window.OFFBEAT_EVOLUTION`. Caches the plan by normalized pattern signature, exposes evolving events to the shared audio scheduler and current-bar snapshots to the constellation renderer. Provides Evolve/Loop Only and an eight-point, novelty-encoded timeline; tapping a point audibly auditions the corresponding bar.
- `public/bass-mirror/evolution-ui.css` — compact and phone-safe connected phrase timeline, small labels and 44+ px controls.
- `public/bass-mirror/index.html` — existing `hit(absoluteStep,when,...)` now schedules events from evolution when enabled and falls back to the prior one-bar loop when disabled. **The exact same `hit` function is used by live `advance()` and offline `exportLoop()`.**
- `public/bass-mirror/v5-constellation.js` — draws the currently playing evolution bar, rather than always visualizing the base bar. During an open A/B proposal, it defers to the V3 decision engine for an honest before/after picture.

## Compatibility & behavior
- Default Evolve On. Toggle to Loop Only for the exact previous behavior.
- Eight-bar evolution cycles when live playback continues. Export always renders the complete eight-bar plan starting at the beginning.
- Tap a bar while stopped -> playback begins on that bar using the actual trusted iOS gesture. Tap a bar during playback -> scheduler jumps to it at the next safe scheduling point.
- Same original bass snippets and found percussion are used; no synthetic pitched instruments.
- An open V3 A/B proposal temporarily falls back to the original loop so before and after are directly comparable.
- Preset switches, sequencer edits, and kept mutations invalidate the cached evolution arrangement automatically.

## Invariants (build-blocking)
`npm run test` runs the built-in Node test suite in `tests/evolution-core.test.cjs`. `npm run build` runs tests before Vite so future code changes can block bad production releases.

Tests enforce:
- 8 valid bars;
- original preserved in bars 1, 2, 8;
- initial input immutable;
- strongest anchor sample unchanged across bars;
- bounded variation in middle bars;
- live and export hit generation shares identical events;
- loop repetition is deterministic;
- malformed input is ignored gracefully.

## Honesty boundary
The `low / pulse / rise / spark` labels identify sample slices, not verified musical notes. The novelty curve represents changes in sequencer placements, not a psychological interpretation of the musician's intentions.

## Manual device QA remaining
Vercel test gate and production build passed. A real iPhone Safari playback and interaction check remains essential: tap Play; watch bar progression; tap 05; toggle Loop Only; export and inspect/compare WAV; A/B branch; avoid audio context regressions.

## Next meaningful move
Add an analyzer that segments the **original improvised recordings** into candidate phrases by onset/rhythmic fingerprint, keeps source timecodes and confidence, and links repeated gestures to auditionable source excerpts. This will turn the current reconstruction-based Memory map into performance-based musical memory.
