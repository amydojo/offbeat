# FORM 007 — GROOVE FRAME
Product + interaction + engineering specification · October 18, 2026
Status: Playable experimental MVP implemented and deployed at /instrument/frame/ on October 18, 2026. FORM 006 at /instrument/ remains untouched. Automated tests pass; physical iPhone listening remains to be verified.

## Vision
Figma Auto Layout for sound: let someone change a musical shape while the system maintains the musical relationships they choose. Replace performance-first music making with listening, manipulating, discovery and expression.

North-star feeling: “I moved one thing, the whole groove responded, and now I want to try something else.”

MVP question: Can a complete novice create two personally meaningful variations of a musical idea without knowing notes, scales, chords or instrumental technique?

## UX contract
First open: “Find your groove.” One prominent START control, not a blank playable grid. The user-initiated tap unlocks audio, decodes local bass samples and starts a *curated* looping musical idea.
Within ~20 seconds, a novice should hear the groove, move one bass contour point, and compare the newly responsive arrangement with the untouched original.
After START, show one large two-bar bass shape, understated timeline/progress, restrained drum accents and one supportive harmony strand. The main action is to move a contour point. Don't start with buttons for WARM/DRIVE, rhythm mode, POCKET, KICK, SNARE or music-theory settings.
Guidance is not a tutorial: “Try lifting this one,” then “Leave a space,” “What if it starts later?”, “Hear original,” “Try another,” and “Keep this.” Avoid wrong notes, grades, scores, gamification and forced instructions.
User's original shape must never be overwritten. All generated changes are derived and fully reversible.

## Musical starter
Ship ONE exceptional preset first: “A Little Offbeat”: warm/bouncy, 96 BPM, 2 bars = 8 quarter beats = 5 seconds, D-minor pentatonic pitch palette (D, F, G, A, C), 6–8 articulated bass notes, purposeful rests, coherent kick/snare/hat pattern, subtle supporting harmonic line.
Use existing licensed, bundled electric bass samples from FORM 005 and existing drum synth from rhythm-v2.js. No network-hosted audio or backend. Compose, audition and mix the starter by ear: technically valid notes are insufficient if the musical result is dull. Avoid muddy kick+bass buildup, too many bright notes and false precision.
Begin with one tonal center and a subtle dyad or sparse chord voicing, not a sophisticated multi-chord theory engine.

## Main interaction
The user sees a 2D contour. Horizontal position = relative location in the 2-bar loop; vertical position = intention to move the note higher/lower. User taps a large point and drags it vertically. Preview the alternate bass pitch immediately, but swap the *full repeating arrangement* atomically at the next bar/loop boundary to avoid discontinuities.
The editing model uses points with stable IDs, timeBeats, normalized height, durationBeats, velocity, and optional expressive timing offsets. No note names or fret labels required.
Horizontal timing editing comes after the first vertical edit; expose it by a clear one-time affordance, not ambiguous freeform drag on mobile. Empty space/rests matter as much as sounding notes.
The movement changes the underlying user contour. Auto Layout recompiles a bass event and one or more linked musical response events. The visuals make this relationship observable. Generated music must not wildly rearrange unrelated material.

## The Auto Layout contract
A pure deterministic engine compiles: compileFrame(frame, constraints, seed) -> { bassEvents, drumEvents, harmonyEvents, causalChanges }.
The same saved shape, locks and seed MUST reproduce exactly the same result in listening, replay and offline export.
Frame contains original intent, NOT generated audio. Events carry stable IDs, origin = user/generated, derivedFromIds, engineVersion.
- Pitch guidance: with Keep Harmony ON, choose an appropriate nearby tone from the preset's allowed palette, preferring the smallest change. Preserve the raw drawn height separately. With it OFF, permit unconstrained pitch; do not hide the less-consonant result.
- Harmony response: a small supporting dyad/voicing changes at a related contour event when that bass note moves, within the tonal style. This is the essential musical-dependency proof—not just pitch snapping.
- Drum response: kick/snare backbone continues; selected quiet accents/rests respond to bass onsets and empty spaces. Changes to a bass note do not randomize the rest of the groove.
- Keep Pulse ON: preserve BPM, loop boundaries, strong beat identity; do not globally quantize the user's source.
- Keep Feel ON: preserve raw relative timing and gesture nuances as a cohesive motif. Generated events can adapt, raw input cannot be rewritten.
- Constraint priority: original source > explicit hard locks > minimal derived adjustment. If a constraint conflicts, keep source intact and show a reversible suggestion.
All derived changes explainable with an ID relationship. Avoid “AI understands you” claims; no ML is necessary for v007.

## Constraints UX
For first-use, only a single compact “Keep together” state is needed. Under MORE > RELATIONSHIPS, show explicit Keep Pulse, Keep Harmony, Keep Feel toggles. Pulse/harmony default ON. Expressive performance event input is always retained regardless of those settings.
The value is audible, not in showing checkboxes. One change should let the user hear relationships being maintained and be able to turn assistance off.

## Discovery + variants
“HEAR ORIGINAL” is persistent after first change. “TRY ANOTHER” generates a deterministic, distinct accompaniment variation based on the SAME user-authored shape, never replacing it. “KEEP” bookmarks the current branch. Keep a small branch tree (original + up to three visible variations for MVP) and one-tap undo.
Do not reward endless automatic generation; reward curiosity about the consequences of the user's edit.
Save to browser local storage with versioning. Portable WAV export should be supported. Project JSON export/import is a follow-on; never imply cloud sync or secure backup.

## Interface / editorial direction
Swiss editorial / quiet computational instrument. Espresso almost black, restrained terracotta and taupe. One dramatic bass contour, a few clear nodes, tiny supporting drum accents, one animation at a time, two dominant type sizes, strong hierarchy. No dense piano roll, tiny inspector panels, neon visualizers, knobs, tutorial walls or flashy HUD. UI should serve tactile discovery with one thumb.
Mobile-first 320 / 375 / 390 / 430px; min 44px touch targets; no mobile zoom or scroll while interacting with the contour. Preserve global accessibility zoom outside of instrument surface.
A/B and undo must be legible and thumb-accessible.

## Build route / file plan
Build separately at public/instrument/frame/index.html so FORM 006 continues working at /instrument/.
Reuse public/instrument/studio-bass-samples-v5.js, studio-bass-v5.js, rhythm-v2.js. Do not copy sample payloads into the prototype. Add:
  public/instrument/frame/core.mjs — immutable frame schema, causal derived events, locks and history.
  public/instrument/frame/music.mjs — curated starter, pitch mapping, deterministic bass/harmony/drum dependencies.
  public/instrument/frame/transport.mjs — Web Audio sample and drum scheduling, seamless loop swap, live/offline consistency.
  public/instrument/frame/ui.mjs — one-touch contour editing, guided variation flow, A/B, undo, minimal UI.
  scripts/form_frame.test.cjs — deterministic transformation, stable IDs, constraint conflicts, unchanged raw source.
  scripts/form_frame_browser_smoke.py — actual Chromium mobile sound unlock, audio decode, drag, causal response, A/B, reversion, no clipping, export.
No new backend, account, paid API, AI model, microphone permission or heavy framework needed for MVP. Preserve current CI and old capture formats.

## Execution slices
A. HEAR — one musically polished 2-bar sampled bass/drum/harmony starter; visual playhead; seamless repeating and iOS sound unlock.
B. CHANGE — edit ONE bass point and hear the note plus a generated harmonic response at the next loop boundary; source preserved; deterministic change trace. THIS is the core product proof.
C. DISCOVER — “try lifting this” guidance, original-versus-new A/B, undo, “try another”, “keep this”, related drum micro-response.
D. TRUST — visible relationship locks, branch saving, offline WAV, accessibility and mobile fidelity, full regression QA.
Build in that order. Do not implement scale libraries, chord progressions, extensive modes, a DAW, full live recording, accounts or generative AI in v007.

## Release acceptance
First-start action reaches actual music reliably; nothing starts before user audio unlock. The groove is objectively repeatable and subjectively satisfying.
Touch editing cannot scroll the page, does not lose events, previews changes promptly, and swaps the loop without audible clicking.
Changing note N moves a specific supporting harmony event derived from N, not a random backing track; unaffected notes and strong pulse remain fixed. A muted note creates an actual rest.
With Keep Harmony OFF, the user can hear the less-guided variant. RAW intent remains immutable and can be recovered in one tap.
“Try another” is seeded and repeatable. Live playback/replay/WAV agree in timing, notes, harmony and drums.
No stuck notes, double-triggered drums, lost pointer captures, out-of-bounds loops or hidden destructive correction. All existing FORM 006 tests stay green.
Run a usability session with people who lack music-theory knowledge: no instructions beyond “play with it.” Measure time to first edit, proportion making a second distinct variation, ability to compare original, whether they felt their decisions—not the AI—were responsible, and whether they'd keep experimenting. Qualitative evidence matters more than number of generated beats.

## Non-negotiables
No blank canvas. No grading. No fake intelligence. No hidden overwrite. No DAW creep. No endless controls. No unearned claims of musical perfection.

**The core product experiment:** What if creative music tools handled *musical relationships* so users could concentrate on curiosity, emotion and exploration instead of performing correctly?


## Implemented MVP checkpoint (October 18, 2026)
The standalone experiment lives at `public/instrument/frame/` with `index.html`, `core.mjs`, `audio.mjs`, and `ui.mjs`. It starts with one curated 96-BPM two-bar loop rather than a blank canvas. The editable bass contour drives causally related harmonic tones and a small number of drum accents. Users can drag points to change pitch, manipulate the selected note's duration handle, insert a rest, compare original vs variation, undo/redo, toggle three genuine musical constraints, hear alternative versions, keep selected variations in browser storage and export an actual WAV. The original FORM instrument was not refactored.

The composition engine is deterministic musical logic and locally rendered Web Audio; it is not a learned AI model. Real bass samples are from the already bundled, credited electric-bass library, drums use local synthesis, and harmony is a deliberately subtle supporting voice. Pulse locking keeps core kick/snare timing stable while related accents respond. The feel lock retains human microtiming in the authored source.

New tests: `scripts/form_frame.test.cjs` plus `scripts/form_frame_browser_smoke.py`, added to GitHub Actions CI, including actual decoded sample playback, 320/390px mobile interactions, original comparison, dependent harmonic change, constraints, persistence and PCM WAV export. Remaining work: audition on a physical iPhone and tune sound/UX with a novice; this prototype is not yet proof of musical satisfaction.
