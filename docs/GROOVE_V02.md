# OFFBEAT / V0.2 GROOVE

**Current product:** On-device, deterministically generated rhythmic responses
to a user's real humming or bass phrase. No cloud inference, audio upload,
automatic grades, forced theory or quantization of the recorded take.

## User flow
1. Record or import a short idea. Once analyzed, open **GROOVE** below Mirror.
2. Try **Follow** to reinforce attack accents, **Answer** for rhythmic responses
   in measured silences, or **Contrast** for independent offbeat drums.
3. Adjust Density, Response, and (Contrast only) Swing. Offbeat initially
   derives approximate drum spacing from source onset gaps. Tap tempo or enter
   a manual BPM when desired; this changes drum spacing, never your voice.
4. **Play with drums** / **Stop groove** loops the chosen original source
   portion alongside Web Audio synthesized kick, snare and hat events.
5. **New variation** increments the deterministic seed. The same source ID,
   selection, mode, controls and seed reproduce the same drum-event list.
6. **Export mixed WAV** renders the source and drum voices into true 22.05 kHz,
   16-bit PCM (mono) audio on this device. 16 seconds max for mobile memory.
7. **Keep this phrase** saves the source audio/analysis plus GROOVE recipe.
   **Export project** includes that recipe in the local portable JSON file.
   Reimport validates provenance and restores playable settings.

## Model of timing
- Original audio remains unmodified and plays at normal speed. Onsets retain
  their original seconds; no source quantization, warp or tempo correction.
- Follow preserves relative source attack timing. Answer uses source rest
  intervals when available. Contrast creates new offbeat events from a suggested
  pulse; swing affects ONLY these generated events. No single "correct"
  groove or note classification is asserted.
- Tone.Transport repeats a bounded phrase by scheduling a Tone.Player and
  Web Audio drum voices at source-relative seconds. All transport IDs owned by
  GROOVE are cleared at Stop and on parameter/source change; non-GROOVE
  players are not wiped by Transport.cancel().
- The same Web Audio drum synthesis routine handles browser preview and
  offline PCM export. Tone.Player fades and offline envelope may vary slightly
  between engines but event placement/voice definitions are shared.
- Sparse or quiet material uses a guarded pulse fallback or introductory kick.
  This is not tempo-recognition proof.

## Validation gates
Synthetic unit tests check deterministic Follow/Answer/Contrast, original
time ownership, source provenance, sparse material, seed variation and RIFF PCM
encoding. Chromium phone emulation checks controls, looping, mixed WAV headers,
local Keep and project portability. These are NOT a substitute for real
iPhone Safari/Android WebAudio, headphones or human musical listening tests.

## Known limits
- Single take and source selection per GROOVE; no sidechain compression,
  per-drum kit choice or editing individual steps yet.
- Drum samples are procedurally synthesized. Lower fidelity than a recorded
  studio kit; expressive feel and reliable timing are prioritized.
- OfflineAudioContext may be unavailable or resource-limited on older devices;
  a clear local error appears instead of a fake export.
- The app does not install a service worker; do not claim robust offline reload.
- Default browser backing store remains origin-specific, not automatic sync.
