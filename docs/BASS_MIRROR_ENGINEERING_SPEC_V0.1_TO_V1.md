# OFFBEAT / BASS MIRROR — Engineering Specification

**Status:** PROPOSED / planning only — no implementation authorized by this document  
**Version:** 1.0 (architecture baseline)  
**Date:** 2026-10-14  
**Repository:** https://github.com/amydojo/offbeat  
**Target:** 2022 MacBook Pro, CPU-capable, local-first web app with optional Python worker  
**Decision rule:** Ship the smallest delightful and trustworthy listening loop before adopting more research models.

## 0. Product decision

OFFBEAT is a musical discovery instrument, **not** a DAW clone, grading app, note-reading tutor, generative-song factory, or emotional-inference system. A player records, hums or uploads an isolated phrase; sees its pitch *movement*, attacks, durations and rests; compares it with another phrase; auditions sections at original timing; saves an accidental favorite; and eventually explores responsive drums and controlled musical transformations.

**North-star moment:** "I hear why the phrase I played resembles the one in my head, and I can keep what is uniquely mine."

**Anti-goals:** involuntary quantization, mandatory notes/fret labels, correctness percentages, unsupported claims about a player's intention or emotional state, uploading recordings to third-party AI by default, auto-publishing copyrighted stems, GPU-required core features.

### User stories

- As a groove-first bassist, I can compare my improvised phrase with a reference at different tempos without receiving a grade.
- As an ear-first learner, I can hum a shape, play it on bass, and compare contours without transcribing sheet music.
- As a creator, I can select a brief musical gesture, loop it, keep the original, and later hear three deliberately different drum relationships to it.
- As a cautious user, I can tell when audio analysis is uncertain, correct mistaken regions, and delete every local artifact.

## 1. Current repo baseline / verified inventory

The existing repo has React 18, Vite 4, Tone.js 15 and react-dnd. It contains three demo loops (loop1.mp3 etc.), a drag/drop VibeBoard, and a Tone.Recorder recording the application's output. It does **not** currently support microphone capture or Python analysis. The checked-in index.html points its module script to /src/; src/main.jsx references ReactDOM and NewApp without importing them; duplicated src/App.jsx and src/NewApp.jsx exist. There are currently no GitHub issues. **Do not treat the checked-in demo as a passing application until the entry point and build are validated.**

Retain: React/Vite shell, Tone for audio scheduling and sample playback, existing demo sounds if licensed for reuse, basic drag/drop ideas. Decouple / replace: broken entry point; recorder ownership; accumulating loop players; unsupported .wav filename for a recorded MediaRecorder/Tone Blob; unbounded state; implicit auth/database concepts.

## 2. Releases / exits / non-goals

| Stage | User-visible experience | Exit requirement | Explicitly deferred |
|---|---|---|---|
| V0.0 foundation | App opens and demo loop plays/stops | Clean install + build + smoke test; no leaking/duplicate players | Models |
| V0.1 **Mirror** | Mic/import -> waveform + contour + attacks/rests -> two-take comparison -> A/B audition -> keep a phrase | Complete offline/local loop, uncertainty shown, golden fixtures and keyboard journey pass | Automatic stem separation, online accounts, generative drums, accuracy scores |
| V0.2 **Groove** | Select bass segment -> three responsive drum behaviors -> edit and export mix | Audible reaction to onset, accent, rest; deterministic replay and stable timing | Neural drummers |
| V0.3 **Library** | IndexedDB sessions, recorded source provenance, phrase fingerprints, revision history, export/import | Durable reopen, corrections preserve originals, explicit deletion | Public sharing |
| V0.4 **Research adapters** | Optional Beat This!, Basic Pitch, PESTO evaluation, similarity experiments | Measured improvement vs baseline; complete license + reproducibility record | Model proliferation without value |
| V1.0 **Musical instrument** | Reliable capture, mirror, groove, library, controlled variations and exports | Cross-browser product QA, auditable model choices, privacy + accessibility gates | Social feed, always-on listening, GPU-only inference |

The initial milestone is V0.1, not all of V1. Core v0.1 should function with a DSP-only adapter when pretrained weights are unavailable.

## 3. Deployment topology and runtime ownership

~~~text
Browser (Vite / React, desktop or mobile)
  ├── getUserMedia + MediaRecorder: explicit microphone capture
  ├── file picker/drop: audio reference or solo instrument
  ├── Web Audio / Tone.js: playback, loop ranges, drums, export graph
  ├── Canvas/SVG + semantic HTML: contours, attacks, rests, controls
  ├── IndexedDB: opt-in saved original blobs and immutable derived records
  └── FastAPI localhost HTTP on loopback (no cloud hop)
        ├── ffprobe/FFmpeg: validate, decode, resample analysis copies
        ├── deterministic DSP baseline (librosa/NumPy/SciPy)
        ├── optional adapters: PESTO, Beat This!, Basic Pitch
        └── stateless analysis/compare JSON; no retained source recording
~~~

Ownership:
- **Browser** controls user intent, microphone permission, the canonical original audio Blob, selection, playhead and the Tone.js clock. Transport must not depend on Python round trips.
- **Python** runs batch analysis only, with bounded per-file timeout and explicit adapters.
- **Contract** owns quantities, units, sources, quality flags and model provenance. Frontend never consumes model-specific raw structures directly.
- **Local storage** stores favorites only after opt-in. No production DB, remote object store, authentication, server queues or cloud model API in V0.1.
- **Distribution:** development Vite on localhost + Python 127.0.0.1:8765. Production packaging of local analysis is a later decision; a deployed static web page cannot access an absent local worker automatically.

Technical baseline: pin supported Node and Python versions via tested lock files (initial Python 3.11/3.12 compatibility evaluation), prefer uv for Python dependency locking, npm existing until a migration has a reason. Keep optional ML dependencies in install extras, separate from the no-model baseline.

## 4. Recording, ingest, and analysis preprocessing

**Sources:** solo_bass, humming, separated_stem, mixed_reference (last type accepted only for preview/beat analysis initially, not trusted note-by-note pitch).

**Capture:** user presses Record; explicit microphone grant; recording indication persistent while active; immediate Stop; allow playback before analysis. Feature detect MediaRecorder MIME formats with isTypeSupported and preserve the actual Blob.type; never rename a WebM/AAC container as WAV. Headphone recommendation and optional monitoring OFF to avoid feedback. Support permission denial, no device, session interruption, canceled upload.

**Ingest:** initial formats WAV, FLAC, MP3, M4A/AAC, WebM/Opus subject to FFmpeg decoder support. First limits: 60 seconds max decoded audio, 25 MB compressed bytes, at most 2 clips per comparison, 1 active analysis job; validate content signature and decoded duration, not extension alone. Inform the user that longer imported songs need a cropped range before analysis.

**Preprocessing:** calculate SHA-256 of original bytes; decode to reproducible mono float32 analysis buffer (document channel-downmix strategy); retain original sample rate, channels, mime and duration; resample per adapter (baseline use 22050 or 44100 Hz as the specific detector requires); preserve time origin and never overwrite original. Detect clipping, near-silence, low SNR, truncated file, DC offset; surface flags. No arbitrary public file paths or shell command interpolation; fixed FFmpeg argv with timeout, memory and disk limits; cleanup every temporary file on success/failure/cancel.

## 5. Versioned audio feature contract

Canonical shared file: **contracts/phrase.v1.schema.json** (JSON Schema 2020-12); derive Pydantic models and TS type/schema from one agreed contract, with bidirectional golden-fixture parity. Contract version **offbeat.phrase.v1** is stable for V0.1. Never return NaN, Infinity or invalid timestamps. All timeline timestamps in **seconds from source start**, all frequencies Hz, timing origin documented.

Representative **illustrative** response (not measured audio):

~~~json
{
  "schema_version": "offbeat.phrase.v1",
  "analysis_id": "4d57a572-e83a-4c59-9173-22cb02c846d1",
  "source": {
    "sha256": "64_lowercase_hex_placeholder",
    "kind": "solo_bass",
    "duration_s": 8.4,
    "sample_rate_hz": 48000,
    "channel_count": 1,
    "mime_type": "audio/wav"
  },
  "processing": {
    "analysis_sample_rate_hz": 22050,
    "timebase": "source_start_seconds",
    "analyzer_version": "0.1.0",
    "pitch_adapter": "baseline_yin",
    "pitch_model_version": "baseline-0.1",
    "onset_adapter": "librosa",
    "config_hash": "sha256_of_config",
    "duration_ms": 427
  },
  "pitch_frames": [
    {"t_s": 0.1, "hz": 82.4, "confidence": 0.93, "voiced": true},
    {"t_s": 0.12, "hz": null, "confidence": 0.2, "voiced": false}
  ],
  "onsets": [{"t_s": 0.1, "strength": 0.85}],
  "rests": [{"start_s": 1.2, "end_s": 1.65}],
  "phrases": [{"start_s": 0.1, "end_s": 2.2, "method": "rest_boundary"}],
  "quality_flags": [],
  "warnings": []
}
~~~

Schema requirements:
- Validate actual SHA-256 as 64 lowercase hex, UUID for analysis ID, enum values and bounded array sizes. The placeholder above intentionally is not valid fixture data.
- t_s within [0, duration_s], arrays sorted ascending; no overlapping rests; end > start; no negative durations; normalized strengths/confidence within [0,1].
- Silent/unreliable pitch is **null/voiced=false**, never interpolated as an invented note. Absence of trustworthy confidence should be explicitly signaled, not set to 1.
- Relative contour is **derived for display/comparison** using 12*log2(hz/reference_hz) on voiced regions only, anchored to an explicit median stable or user-selected reference pitch; keep original Hz immutable.
- Separately store **source audio**, **machine analysis**, **user edits**, **comparison decisions** and **presentation view preferences**. A correction cannot silently overwrite machine output or provenance.
- Model metadata: adapter identifier, package version, weight SHA/revision when relevant, device, inference options, threshold configuration, warnings; include license in adapter registry rather than pretending inferred musical meaning is a scientific fact.
- Optional beat track, note events and embeddings belong in versioned **extensions**, not required V0.1 fields.

Comparison response **offbeat.compare.v1** has reference/played analysis IDs, original-time intervals, alignment anchors, normalized-time mapping, matched/unmatched onset groups, comparable voiced coverage, contour-shape descriptors, rest correspondences, timing offsets and confidence/warnings. **No overall musical accuracy or quality score.**

## 6. Python HTTP API

Base prefix **/v1**, only binds 127.0.0.1 in development.

| Method and route | Request | Success | Errors |
|---|---|---|---|
| GET /health | none | capability list, API/schema version, installed adapter availability; no personal paths | 503 optional feature unavailable only if requested |
| POST /v1/audio/analyze | multipart file + JSON options: source_kind, adapter preference, pitch range, crop region; bounded | offbeat.phrase.v1 + processing metadata | 400 bad option, 413 size, 415 invalid media, 422 decode/empty, 408/504 timed out, 503 adapter unavailable |
| POST /v1/compare | JSON with two validated phrase.v1 feature objects, preferred alignment mode | offbeat.compare.v1 | 400 incompatible schema, 422 inadequate coverage, 503 optional unavailable |

All errors structured as:
~~~json
{"error":{"code":"AUDIO_SILENT","message":"We could not find enough audible playing to analyze.","retryable":true,"details":{}}}
~~~

No user-supplied path to process; multipart bytes only. Browser retains source Blobs. Streaming/progress is deferred unless synchronous jobs violate performance targets; allow cancellation via AbortController with server disconnect handling, strict request deadline and temporary work cleanup. No debug audio dumps or raw file content in exceptions.

A local server is not automatically safe: enforce Origin allowlist, non-simple JSON/multipart requests with an application-specific header, no cookies, default CORS deny, no wildcard origins, no unauthenticated sensitive GET resources, bounded request bodies; document additional local-session token hardening before redistribution. Explicit preflight errors when the worker is absent; never quietly call an external AI API.

## 7. DSP + model adapter interfaces

Stable Python interface (conceptual):
~~~text
PitchAdapter.analyze(audio, sample_rate, options) -> PitchFrames + Diagnostics
OnsetAdapter.analyze(audio, sample_rate, options) -> Onsets + Diagnostics
BeatAdapter.analyze(audio, sample_rate, options) -> Beats + Diagnostics
EmbeddingAdapter.embed(audio, sample_rate, options) -> Embeddings + Diagnostics
~~~

**Baseline V0.1:** librosa onset envelope + transient peak picking, RMS and dB envelope for dynamics, thresholded rest segmentation, and a pitch estimator evaluated on E1 (~41.2 Hz) through typical bass upper register. Compare YIN/pYIN or an autocorrelation baseline on monophonic bass/humming. Ensure onset vs pitched-frame boundaries do not imply all attacks have a known note. The baseline should be usable even when no ML model is installed.

**PESTO (optional V0.1 evaluation):** use official SonyCSLParis/pesto inference package; produces time/frequency/confidence. Benchmark octave errors, false voicing, bass low E and harmonics, hum, attack transients, CPU speed. Its project code is LGPL-3.0; audit weights, attribution and distribution conditions before bundling. Make fallback selectable and never silently claim a model ran.

**Beat This! (V0.4):** optional beat/downbeat adapter for full mixed references; CPU small0 candidate, explicit inability to infer a stable BPM from sparse solo bass; allow tap-tempo/user grid override at any time. Official code and published weights are MIT, but investigate training-data provenance questions before commercial distribution.

**Basic Pitch (V0.4):** optional isolated-instrument pitch-to-MIDI, for export/edit only; note events remain fallible and never overwrite the expressive continuous contour.

**Research (late V1):** MuQ/MuLan embeddings, GrooVAE, DDSP, RAVE as separate feature-flagged experiments. Record weights license individually (including noncommercial restrictions), CPU/GPU budgets, data handling and measured end-user improvement. No shipping pretrained model merely because it is impressive.

Research references: https://librosa.org/doc/main/ ; https://github.com/SonyCSLParis/pesto ; https://github.com/CPJKU/beat_this ; https://github.com/spotify/basic-pitch ; https://tonejs.github.io/ .

## 8. Comparison and similarity semantics

Two independent lanes: **rhythmic gesture** and **melodic contour**.

1. Identify usable phrase ranges with rests/onsets; user can adjust both start/end handles.
2. Never alter source files; present original timeline and optionally a separate normalized-time overlay.
3. Rhythm: compare onset spacing, relative intervals, phrase density, accent envelope and rest placement; identify matched and unmatched attacks. Sparse or free-time clips must support manual tap-grid / no-grid modes.
4. Pitch: compare interval contours in semitones relative to each phrase's explicit anchor. Ignore unreliable/unvoiced frames and excessive octave-jump outliers; report comparable-coverage fraction.
5. Optional constrained dynamic time warping on shape features with slope/window limits; record mapping and demonstrate that an overflexible match is rejected. Display stretch amount. DTW never "proves" a phrase is correct.
6. Descriptors must be descriptive, not evaluative: "both begin low and rise after a rest" vs "you scored 80% accuracy." Present confidence/coverage; omit a descriptor if evidence is weak.

**Important:** bass-only BPM is frequently ambiguous. Distinguish tempo of a mixed reference from a player's attack interval and surface alternative half/double-time interpretations.

## 9. Visual interaction spec

Design language: minimal editorial audio instrument, not a conventional DAW grid. Contours should feel fluid but **accurate and inspectable**. One primary workspace, accessible on laptop and mobile.

A. **Capture surface:** Record / Upload / Try sample; mic status; actual filename/format; no surprise permission request; preview before analyzing; clear source type.

B. **Mirror surface:** Reference lane and Your Take lane; horizontally aligned time axis; relative pitch contour with gaps, attack markers, accented pulses and rest bands; hover/focus inspector shows time, pitch if confident, source quality, and adapter; accessible textual equivalent of contour segments. Three listening modes: reference solo, performance solo, alternating A/B. Original-time default; normalized overlay requires user toggle and visual labeling.

C. **Select surface:** draggable begin/end handles; playback only inside selected source region, sample-accurate enough to avoid audible wrong cuts, 30 ms-ish click-safe microfades at cut edges as a target; audition Repeat, Slow (pitch preserve optional later), Original timing; keyboard adjustments and audible confirmation.

D. **Keep surface:** user-supplied phrase title optional; saved recording and immutable selected time range; derived musical DNA traits from known evidence; create a new saved revision on any correction. Do not autoclassify mood or personality.

E. **Groove V0.2:** Follow (kick supports strong accents), Answer (drums respond in rests), Contrast (alternate but musically constrained); dial **response strength**, separate swing, and never silently quantize the saved phrase; metronome and manual tempo.

UX states: awaiting permission, recording, decoding, analyzing, partial confidence, no signal, successful analysis, no local Python worker, not enough comparable material, user corrected, saved, export ready. Reduced-motion and no-canvas text modes are first-class.

## 10. Groove engine timing contract (V0.2)

Tone.js Transport is the playback clock, with scheduled events/ticks and a documented tempo map; Python returns offline onset/accent/rest events. Drum engine accepts source segment, user beat grid, groove mode, density, swing, seeded randomness and event windows. It emits deterministic beat events (time, instrument, velocity, origin: follow/answer/contrast) for reproducible playback/export. No direct live Python callback on each tick. Preserve original unquantized bass audio; quantize only drum events if selected. Guard against double kick events and loop-edge discontinuity. Drum preview must sound usable even without pretrained models.

## 11. Local storage, exports, rights and deletion

- V0.1 working session is in memory. Opt-in favorites in IndexedDB; store original audio Blob + SHA, immutable analysis JSON, manual edits, selected times, stable model/version metadata and thumbnail/waveform summary. Provide visible Delete / Delete all; clear temporary blob URLs and microphone streams on unmount.
- Avoid LocalStorage for audio bytes and never put audio blobs in URL/search params. Quota errors should not erase working session.
- V0.2 export actual mixed audio to a accurately labeled format based on encoder capabilities; WAV requires real PCM encoding (not changing extension). MIDI note-event export is explicitly optional and must be labeled estimated.
- No automatic ingestion of proprietary streaming URLs or DRM bypass. Existing third-party reference recordings are analyzed privately for user-driven study; do not publish or share raw protected stems or derivative packs.
- No background mic access, telemetry, analytics, external transcription provider or cloud storage by default; if future cloud inference is considered, require a separate explicit consent and data retention design.

## 12. Performance targets / capacity

**Initial engineering targets, not existing measured performance:** on one 2022 MacBook Pro, browser capture never stalls UI; usable waveform preview < 1 s after decoding a short clip; baseline DSP analysis of 10 s mono audio within 10 s p95 after warmup; response serialization < 2 MB for 60-second clip using decimation/sparse arrays; playback start < 250 ms after ready; no stutter while inspecting. Record test machine, OS, sample rate, CPU/device, adapter, warmed/cold timings and peak resident memory. PESTO and other optional models require separate budgets. Set failure threshold and degradations from measured evidence rather than inventing speed claims.

## 13. Golden audio corpus and acceptance testing

Corpus must be **license-clean**, small and versioned with attribution. Commit synthetic waveforms and generated MIDI/drum patterns; store any user's own real recordings only with permission in a private, noncommitted local test directory. No copyrighted ESSE stems or raw user private recordings in public CI.

**Fixture cases:** silence, white noise, low E1 (~41 Hz), sustained pitch with harmonic overtones, ascending/descending phrase, pluck transient, pick transient, fingerstyle transient, humming, clipped signal, stereo phase cancellation/downmix risk, swing/off-grid attacks, sparse phrase, double-tempo case, near-silent/noisy room, format mismatch, invalid compressed file, 60 s boundary, and two clips with same contours at different tempos.

Quality gates (initial targets, tune only with recorded validation):
- synthetic onsets: >=90% matched within 50 ms, low false-positive count in rests; report precision and recall separately.
- isolated clean synthesized pitch: >=85% of reliable voiced frames within 1 semitone of known F0, plus **octave error separately**; use confidence/coverage and measure bass E1 explicitly; no pass from measuring only high notes.
- synthetic rests: start/end within 100 ms where clearly isolated; silence must not be hallucinated as a note.
- comparison: two tempo-scaled same-shape fixtures align in normalized view while originals stay unmodified; different-shape fixture cannot be described as identical.
- API: invalid type, oversized bytes, >60 s decoded content, truncated decode, malformed schema, optional adapter missing, cancellation and concurrent jobs return explicit bounded errors; temp artifacts removed.
- frontend: mic grant/deny, recorder stop, import, no-worker message, waveform/contour keyboard navigation, A/B playback, selection, save/reopen/delete, reduced motion, screen-reader summaries; test Chrome + Safari on macOS, mobile layout.
- audio: no doubled playback or leaking Tone players, no silent conversion of file format, correct export metadata, original audio identical after reanalysis.
- security: bind loopback only, strict Origin rules, no filesystem traversal or unbounded FFmpeg, no accidental outbound network, no raw audio in telemetry/logs.
- **Human listening study:** at least 5 bass/humming samples across picking styles; 2–3 listeners judge whether visual events reflect audible structure; document systematic failure cases without making performance claims.

Automated gates: frontend build/lint/unit (Vitest), Playwright basic interactions, Python ruff/pytest/type checking, JSON contract parity and fixture benchmarks. Install/model download tests must not silently incur GPU/cloud costs.

## 14. Architecture decision records (to write when implemented)

ADR-001 Browser owns transport; Python is post-recording batch analysis.  
ADR-002 Canonical audio feature representation and provenance.  
ADR-003 DSP baseline before optional pretrained models.  
ADR-004 Local-first persistence and explicit deletion.  
ADR-005 Rhythm/contour comparison without grade.  
ADR-006 Inference licensing, device tiers, and model rollout gates.

## 15. Issue and dependency plan

**Gate A / foundation:** BM-01 repo repair; BM-02 reproducible tooling and CI; BM-03 feature schema + golden fixtures.  
**Gate B / capture + API:** BM-04 mic/import/real-format capture; BM-05 Python API/decode + security; BM-06 baseline signal analysis.  
**Gate C / MVP experience:** BM-07 optional pitch-model spike; BM-08 mirror UI; BM-09 comparison; BM-10 listening/selection; BM-11 local favorites; BM-12 V0.1 privacy/a11y/performance/release review.  
**Gate D / V0.2–V1:** BM-13 rule-based groove; BM-14 phrase library + interoperable exports; BM-15 beat/reference timing; BM-16 optional MIDI; BM-17 mutation/creative variations; BM-18 similarity/model lab; BM-19 shipping/distribution research.

Sequencing guidance: BM-03 precedes all contract-consuming endpoints/UI; BM-05 + BM-06 precede visualization/comparison; BM-08 + BM-09 + BM-10 + BM-11 precede V0.1 release. **BM-07 is optional and cannot block V0.1 if baseline reaches test gates.** Neural and streaming features cannot block the core release.

## 16. Decision log / unresolved experiments

- Final baseline F0 detector: choose by benchmark, do not assume one research model handles E1.
- Browser audio MIME variation and Safari compatibility: feature-detect and verify on actual devices.
- Storage schema and IndexedDB size: choose after recording fixture sizes known.
- Beat tracker on solo bass: treat predictions as provisional; offer no-grid mode.
- License review before bundling any weights or redistributing models.
- Native desktop packaging vs local two-process web development: defer until V0.1 proves value.
- Separation of personal reference stems from exports: keep user source private and preserve rights.

## 17. Completion definition

V0.1 is ready only when a first-time musician can open Offbeat locally, record or upload *two* isolated phrases, see evidence-backed contour + onsets + rests, toggle original vs normalized comparison, audition A/B, select a favorite few seconds, and save/delete it — **without external processing, sheet music, false certainty, data loss, confusing latency or grading**. A model upgrade is successful only if it demonstrably makes this easier, more accurate or more creatively useful.

**Planning-only artifact:** this specification authorizes no implementation changes. Work occurs later in reviewed, scoped PRs tied to the issue backlog.
