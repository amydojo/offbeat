# OFFBEAT / Performance Memory V1 — Full-session musical discoveries

## Current release
Route: `/performance-memory/` under existing `amydojo/offbeat` / Vercel project.

### Why this feature exists
Bass Mirror's original Memory display represented a 16-step pattern assembled from earlier snippets. Performance Memory analyzes a newly selected **complete source recording**, proposes temporally distant recurring gestures, and lets the musician verify them by listening to both original excerpts. Mathematical similarities are not asserted to be identical notes, intentions, or musical meaning.

## Mobile journey
1. Open Performance Memory from the OFFBEAT homepage.
2. Choose a supported audio file from Files (M4A, WAV, MP3, etc.).
3. The phone locally decodes the recording at 12 kHz using `OfflineAudioContext`, then analyzes short-time energy, transient/attack candidates, and timing fingerprints.
4. See a single connected constellation with positions proportional to the **source timeline**; selected nodes are linked by arcs. Tap a node to hear one source excerpt.
5. Hear A or B (each ~4.8 s), mark **Same Idea** / **Not the Same**.
6. Re-open saved connections from the Idea Vault. Only timestamps + verdicts persist in localStorage, keyed to metadata of the chosen file.

## Architecture
- `public/performance-memory/index.html`: independent route. Accessible without modifying the trusted Bass Mirror sound sequencer.
- `phrase-core.js`: pure, testable onset and repetition-candidate module. Input is decoded AudioBuffer; output is duration, attack events count, candidate windows count, low-resolution overview, and top separated candidate pairs.
- `app.js`: DOM controller, File input, offline decode, owned blob URLs, native audio A/B clip playback, map interactions, and localStorage confirmations.
- `style.css`: espresso/terracotta mobile-first minimal constellation and thumb-accessible controls.
- `tests/phrase-core.test.cjs`: synthetic cases (distant repeated motif, adjacent window suppression, distinct patterns, silence, immutability).

## Meaning of the score
- Candidate phrases are 4.8 s windows starting near a detected attack, spaced approximately 1.75 s apart.
- At least 25 seconds separates a proposed pair, avoiding adjacent overlap.
- Fingerprints contain an onset timing distribution (20 bins) and a normalized energy contour (20 bins).
- Comparison tolerates ±one time bin. Distinctiveness uses the **mean-centered energy contour** to avoid treating all loud passages as equivalent.
- Candidate pairs are sorted by composite resemblance and shortlisted after a minimum spacing / similarity threshold.
- UI shows **relative percentile rank among eligible comparisons in that recording**, not the probability of the same riff or a note-transcription accuracy. Manual verification is mandatory for a confirmed memory.
- No neural network, pitch tracking, key detection, or automatic inference of emotional/creative intent is claimed.

## Privacy and persistence
No file uploads, no server analysis, no public GitHub audio assets, no remote AI inference. The chosen file is read and decoded in the browser. A `blob:` URL is used by the local media player. It is revoked when the file is replaced. Confirmations are stored locally as approximate source positions and decisions; audio must be reopened from Files to audition after the page reloads.

## Engineering guarantees
- Existing Bass Mirror V6 WebAudio scheduling and exports were left intact.
- Existing OFFBEAT homepage gets a direct `PERFORMANCE MEMORY` entry.
- Tests run as part of Vercel build via `node --test tests/*.test.cjs`.
- On real Bass 4, an independent verification pass found a large number of rhythmically similar pairs, motivating relative ranking and a more discriminative energy-contour component. Results remain candidates until the musician confirms them.
- Static syntax and Vercel builds verify integrity, **not actual iPhone Safari playback or decoder memory handling**.

## Future important improvements
- Confidence-aware low-frequency pitch contour / note identification for discriminating different riffs over the same beat.
- A versioned analysis cache in IndexedDB (user opt-in) and better handling of very long files, preserving privacy.
- Interactive graph where confirmed motifs become visually stronger and false matches collapse.
- Export a confirmed moment as a trim, musical MIDI-like rhythm pattern, or Bass Mirror seed, using explicitly user-reviewed source excerpts.
- Empirical QA on multiple iPhone models, especially 12+ minute compressed M4A decoding and Voice Memos formats.
