# OFFBEAT / BASS MIRROR 003 — Musical Memory Lab

## Intent
Turn accidental musical discoveries into an inspectable, editable musical memory. This is not a generic audio visualizer and does not grade instrumental skill.

## Product philosophy
- **Hear first.** The original bass sounds must remain playable; visualization must never be a prerequisite to sound.
- **Preserve before transform.** A musical idea is protected by default (LOW sample initially). New variations are heard as A/B, then explicitly kept or discarded.
- **Show the evidence.** A pattern insight refers to the exact observed sequencer events—not invented note names or psychological claims about the player.
- **Treat silence as information.** Removing an event is a real musical decision and is visualized with an outlined ghost marker.
- **No account dependency.** The sample instrument executes locally in the browser. Saved named patterns are stored in this device's localStorage only; exported WAV is portable.

## Current architecture
- `public/bass-mirror/index.html`: independent instrument page with embedded MP3 sample fragments from bass sessions 3.1, 3.2 and 3.3.
- `public/bass-mirror/v2.js`: iOS Web Audio unlock, sample engine, phone-speaker harmonic reinforcement, waveform/spectrum and historic event marks.
- `public/bass-mirror/v3.js`: semantic 16-step Memory map, grid-derived pattern scan, constrained deterministic decision engine, A/B and local versions.
- `v2.css` / `v3.css`: incremental design layers; V3 moves away from glows and ambiguous particle diagrams, toward aligned marks and fixed scales.
- Existing OFFBEAT home, recording, comparison and Groove Lab remain separate and intact.

## Data contract — honesty boundary
V3's motif detector runs on **the 16-step sequencer arrangement using nine known sample IDs**, not on the complete performances or recovered physical note pitches. Rows named LOW, PULSE, RISE, SPARK, OTHER, SHIFT and the percussion rows are sample names, **not transcribed pitches**. The sample-level pattern map is a useful first prototype; raw performance recognition remains future work.

## Repetition metric
Take two opposing four-step windows (steps 01–04 vs 09–12, or 05–08 vs 13–16).
Each bass event is encoded as `sample_id:offset_within_window`. Let A and B be sets of encoded events.
- Shared placements = `|A ∩ B|`.
- Similarity = `|A ∩ B| / |A ∪ B|`, if the union is nonempty.
- A motif is shown when there is at least one shared placement; the UI gives the number of matching events and its positions. Higher similarity in this limited metric doesn't prove melodic equivalence.
- The displayed anchor is the most frequently triggered **bass sample ID**, not a detected musical key.

## Constrained decision engine
Protect a sound, then select exactly one class of change:
1. **Write an answer:** add one contrasting bass event to a currently bass-empty slot in the second half.
2. **Echo a gesture:** duplicate one eligible bass event eight steps later, keeping the original.
3. **Make space:** remove one event from an unprotected bass sample that has more than one.
4. **Shift the timing:** move one unprotected bass event one or two steps within its original four-step window.

Changes are bounded to one note event (a movement produces a removed and added marker), deterministic by scan order, and don't touch the protected sample. When no valid action exists, the UI says so.

A / BEFORE and B / AFTER switch the currently playing loop. KEEP chooses the candidate as the new baseline; DISCARD restores the exact original snapshot.

## Current controls / user journey
1. Play to hear a human bass recording sampled into a short loop.
2. Read the **Memory** lane map. Time flows left to right; each sample is on a separate row; muted percussion is separate.
3. Read the found repeat and exact supporting step positions.
4. Tap **Try a musical variation**, choose a protected sample and transformation, listen A/B.
5. Keep or discard, then optionally name a version in Idea Vault. Export eight bars as a WAV.

## Browser constraints & QA
- iOS AudioContext requires explicit user gesture; V2 unlocks before asynchronous decoding. A native audio element remains available as an independent playback path.
- The low bass fundamental can be weak on phone speakers; harmonic boost is optional, and headphones are recommended for critical listening.
- Safari/Chrome manual sound QA remains required. A passing Vite production build does **not** establish that Web Audio playback works on every device.
- Idea Vault does not synchronize across browsers and localStorage may be cleared by the browser. It stores sequencer snapshots, not raw audio files.
- Access to the published instrument is at `https://offbeat-pi.vercel.app/bass-mirror/`.

## Architecture to grow next
**V4: performance-based musical memory.** Separate a reusable input-analysis pipeline from the visual layer:
`record/import → onset extraction → low-pitch confidence stream → phrase segmentation → rhythm-normalized fingerprints → recurrence graph → user-auditioned candidates → memory vault`.
Use uncertainty-aware onset/pitch detection and simple interpretable alignment first. Eventually evaluate time-warped phrase matching and learned embeddings against a small hand-annotated test corpus; do not claim perfect transcription or inferred musical intent.
When source audio is ambiguous, the UI should say what it can and cannot detect.

**V4 experience:** Click a highlighted recurrence in an imported bass improvisation, hear both real source excerpts, keep the phrase and mutate a **derived** pattern—without requiring note names or sheet music.
