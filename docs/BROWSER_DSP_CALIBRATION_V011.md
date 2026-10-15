# OFFBEAT mobile DSP calibration — V0.1.1

**Purpose:** record what the algorithm has actually been tested against, without pretending synthetic fixtures are evidence of real musician performance.

## Changes since browser V0.1
- The on-device pitch estimator uses a **YIN-style cumulative mean normalized difference** rather than selecting the maximum autocorrelation lag. It prefers the earliest clear periodicity minimum and cautiously checks for a clearer doubled period on overtone-rich signals.
- Attacks/rests use short approximately 23ms RMS windows rather than 93ms RMS windows, with conservative energy gating and roughly 90ms attack refractory separation.
- Isolated >8-semitone excursions between neighboring stable pitches are omitted rather than displayed as a sudden invented note.
- A source analysis identifies its algorithm as `browser_yin_cmnd_v2` in `offbeat.phrase.v1`. Original recordings and source timestamps stay unchanged. The DSP remains entirely inside the on-device Web Worker.
- On-screen warnings continue to say **uncalibrated**. Periodicity is only a heuristic, not a calibrated probability of correct pitch.

## Deterministic synthetic regression corpus (CI)
`node --test src/lib/phraseRanges.test.mjs src/lib/browserFeatures.test.mjs` exercises:
- Low bass E1 near 41.2 Hz, with explicit silent passages and missing unvoiced pitch;
- Harmonic-rich low E1 with strong second/third harmonics and an octave-mistake threshold;
- Hummed ~164.8 Hz with light vibrato, rests and overtone;
- Four separated note attacks and bounded spurious attack count;
- Zero-amplitude silence and near-silence, no fabricated notes;
- Source-preserving comparison and rejecting whole-song/short-take force alignment.

These tests measure a **small synthetic set**, not the broader recall/precision targets listed in #27. The tests guard against regressions; they do not establish accuracy on live singing, electric bass through a phone microphone, headphones, echo, noisy rooms or every codec.

## Phone UI failure states (CI)
`scripts/mobile_browser_smoke.py` tests upload → analyze → compare → A/B → Keep → reload → Open → Delete, with a network request assertion that allows only same-origin and on-device blob audio.

`scripts/mobile_failure_smoke.py` checks denied microphone permission, unsupported executable import and successful fake mobile microphone capture/stop/analysis. These run in **Linux Chromium mobile emulation** with a synthetic/fake microphone—not iPhone or Android hardware.

## Release gates still open
- #26: actual iPhone Safari/Android Chrome microphone/decoder, permissions, screen lock, storage and VoiceOver/TalkBack QA. Browser MediaRecorder support and formats differ.
- #27: genuine hum/bass samples with consent; measured voiced coverage, octave error and onset/rest precision/recall. Verify runtime/battery/memory on physical phones before choosing a strict device performance budget.
- #13: release security/privacy/a11y audit. No real-phone sign-off yet.

**Privacy:** No external pitch model, new dependency, cloud inference, raw audio telemetry or server-side analysis was added. Saved phrases still belong to that specific browser origin. Do not clear site data to migrate projects.

**Do not claim** the new algorithm can identify the same melody, the player's intention, or musical correctness. This remains a visualization and listening aid.
