# OFFBEAT — Bass Mirror

An ear-first music instrument for discovering the musical gesture in what you actually play. **V0.1 implementation:** two-track analysis, aligned rhythmic/pitch visualization, source-preserving A/B playback, keyboard-accessible phrase selection, and a local IndexedDB library. Responsive drums remain V0.2.

## Product rules
- No grades, forced note names or fret-placement lessons.
- Audio remains on your device. Microphone permission is requested only when you press Record.
- Browser owns playback and capture; Python only analyzes after you ask.
- Pitched lines are estimates. In particular, current YIN confidence is **not calibrated**; silence must appear as a gap.
- Original audio stays intact. Click **Keep this phrase** to opt in to saving an immutable source plus analysis in your browser's IndexedDB; Open, Delete and Delete all are available locally.

## Run locally

Prerequisites: Node 22, Python 3.11–3.13, FFmpeg in PATH. On macOS install FFmpeg using Homebrew:

```sh
brew install ffmpeg
npm ci
npm run dev
```

Run the Python worker **in another terminal**:

```sh
cd analysis
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
python -m uvicorn offbeat.api:app --host 127.0.0.1 --port 8765
```

Open **http://localhost:5173**. Choose a reference audio file or record your bass using your microphone; press **Analyze shape**. First input is intended for short isolated bass/stem audio, not a dense polyphonic mix. Browser native `<audio>` players let you audition either clip at original timing.

The frontend should still open without Python; analyzing prompts you to start the local worker. No subscriptions, GPUs or secret keys required.

## Tests and known limitations

```sh
npm run build
cd analysis
python -m pytest
```

Current analysis limits: 25 MB, 60 s, monophonic pitch within approximately 36–650 Hz, stereo downmix, FFmpeg decoder required. Onset boundaries, high harmonics, low E bass and noisy recordings require careful listening checks. YIN is a DSP baseline; no pretrained models run. The versioned `/v1/compare` reports aligned attack correspondences, source timing and nonjudgmental contour descriptors. Use **Find the moment in the reference** to select and preview a reference excerpt close to your performance's length; a 54-second song is no longer force-matched with a 13-second hum. Attack matches represent proximity in time **only** and do not establish the same notes or riff. Sparse inputs can produce weak or misleading matches; use the original-time view to verify. For voice performances choose **Humming** as the take's source type and reanalyze.

**Mobile DSP V0.1.1:** An on-device YIN-style pitch tracker with improved short-window attack/rest timing and conservative octave-glitch gaps replaces the initial browser autocorrelation peak selector. See [synthetic regression scope and remaining real-phone QA](docs/BROWSER_DSP_CALIBRATION_V011.md). These synthetic tests do **not** establish measured accuracy on real voices/bass. Source analysis records adapter provenance; older saved analyses remain unchanged.

**Mac hardware checklist:** [physical-device and Safari QA](docs/MAC_MICROPHONE_QA.md) must be completed by someone with the actual Mac. Linux Chromium CI only exercises a fake microphone.

**Follow-up quality gates:** A locked Python environment (`uv.lock`), full screen-reader/accessibility audit, local-worker session-token hardening, and optional PESTO remain planned; see [issues](https://github.com/amydojo/offbeat/issues/1). The npm dependency lockfile has been regenerated for this project and CI now uses reproducible `npm ci`.

Detailed architecture: [Bass Mirror Engineering Spec](docs/BASS_MIRROR_ENGINEERING_SPEC_V0.1_TO_V1.md).

**Privacy/rights:** Only use audio you are authorized to work with; do not upload or redistribute protected stems. No recording is uploaded to a remote service. The Python worker is designed for local loopback access only; do not expose it to the internet.
