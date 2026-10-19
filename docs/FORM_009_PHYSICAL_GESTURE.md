# FORM 009 — Physical musical relationships

**Built:** October 18, 2026.
**Route:** https://offbeat-pi.vercel.app/instrument/gesture/
**Independent comparisons:** FORM 008 remains at /instrument/frame/; FORM 006 remains at /instrument/.
**Source:** /public/instrument/gesture/{index.html,app.mjs,physics.mjs} with reused /public/instrument/frame/{core.mjs,audio.mjs}.

## Product thesis
FORM is no longer a pitch slider or a DAW. Your hand disturbs a musical material. The material's deformation represents authored musical intention; the relationship compiler lets bass, harmony, and rhythm respond to the same gesture.

The original idea came from DOJO LAB / The Shape of Sound (02 / Resonance): https://github.com/amydojo/dojo-lab/tree/main/experiments/shape-of-sound. The experiment demonstrated the value of press/pull/release, spring inertia, a transient musical excitation, and physical memory. This version uses the interaction principles, not a copy of its source or branding. It uses an original fast Canvas2D sculptural renderer (self-contained, avoiding a Three.js CDN dependency), with the existing FORM recorded electric-bass playback and deterministic relational audio engine.

## First user journey
1. Tap **Hear the Groove** (96 BPM; two-bar curated sampled bass + procedural drums + quiet harmony). No blank page.
2. Press anywhere on the dimensional copper ribbon. Drag **up** to raise local bass tension, **down** to settle it, **right** to lengthen the note, **left** to compress it. The amount and speed of travel contribute to velocity/expression and can produce a generated rhythm accent.
3. While holding, the object follows via a damped spring system; a locally sampled bass preview bends under the finger while the loop ducks slightly.
4. Release. The physical ripple settles and leaves a fine copper directional trace. This gesture maps to an immutable source-frame revision; adjacent bass notes deform through FORM's existing local influence falloff. Harmony follows the selected pitch under the Harmony constraint; a high-energy release adds a small percussion response. The main kick/snare pulse is preserved by default.
5. Immediately hear a short bass+harmony response. At the **next loop**, the entire compiled arrangement changes together. The UI distinguishes **HEARING / ...** from **NEXT LOOP / ...**.
6. Review what changed in BASS / HARMONY / RHYTHM labels. Tap **Before / After** to hear the isolated original phrase followed by the new phrase. Toggle Original/Your Version without erasing edits.
7. Revisit a physical gesture from a numbered memory trace, undo, reset, or save a project version. Frame and gesture memory persist in localStorage on this browser; WAV renders from the same music compiler.

## Engineering contracts
- /gesture/physics.mjs exports sampleGesture, chooseAnchor, applyGesture, compilePhysical, physicsStep.
- Gesture data: start position, signed Δx/Δy, tension, speed, direction, travel, elapsed duration. Current release map: vertical change -> pitch and neighboring notes, horizontal change -> authored duration, force/speed -> expressive velocity and response accent.
- compilePhysical reuses compileFrame for bass/harmony/pulse and adds tagged generated percussion if release energy warrants it. Deterministic, no hosted models, no credits.
- UI renderer: responsive self-contained Canvas2D geometry as a slightly twisting, copper-shaded 2.5D ribbon. Each section's centerline is derived from authored frame pitch. Tethers and subtle field lines imply dependent layers. Spring and trace respond to real gesture state; persistent trace originates in gesture memory.
- Audio: reused recorded electric bass with glide audition, sampled release, harmony voice, rule-based drums, real offline WAV. Audio starts only after a user gesture unlocks AudioContext, not autoplay.
- Undo and original retain authored frame. Small gestures may audition without changing the musical state.

## Test and risk
Unit: scripts/form_gesture.test.cjs — verifies signed touch mapping, near-neighbor deformation, changed duration and velocity, actual compiled harmony/drum changes, original frame ownership, determininistic response and damped spring.

Mobile Chromium: scripts/form_gesture_browser_smoke.py — tests iPhone-size interaction, starting actual Web Audio, dragging/releasing, visual response, saved memory across reload, undo, simple accessible interactions, 320px layout, on-device WAV bytes.

**Things to judge by hand:** real iPhone Safari audio startup and the feel of the spring, taste of the default groove, whether the sample-based sustained bend stays musical on long holds, perceptibility of the generated percussion accents. Browser green cannot establish the musical quality or real-device latency.

**No-cost workflow:** browser-local static JS assets, GitHub Actions CI, Vercel Hobby. No paid audio/render API, no generative model, no backend storage or user account.
