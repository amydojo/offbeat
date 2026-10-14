# OFFBEAT — Bass Mirror

An ear-first music instrument for discovering the musical gesture in what you actually play. **Early implementation: foundation + local pitch/attack/rest visualization.** Precise two-take alignment, phrase selection, responsive drums and library are **not implemented yet**.

## Product rules
- No grades, forced note names or fret-placement lessons.
- Audio remains on your device. Microphone permission is requested only when you press Record.
- Browser owns playback and capture; Python only analyzes after you ask.
- Pitched lines are estimates. In particular, current YIN confidence is **not calibrated**; silence must appear as a gap.
- Original audio stays intact. The interface does not currently save your session after reload.

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

Current analysis limits: 25 MB, 60 s, monophonic pitch within approximately 36–650 Hz, stereo downmix, FFmpeg decoder required. Onset boundaries, high harmonics, low E bass and noisy recordings require careful listening checks. YIN is a DSP baseline; no pretrained models run. A/B comparison is deferred to BM-09; /v1/compare explicitly returns 501.

**Follow-up quality gates:** A locked Python environment (`uv.lock`), UI accessibility and browser microphone tests, local-worker session-token hardening, and optional PESTO remain planned; see [issues](https://github.com/amydojo/offbeat/issues/1). The npm dependency lockfile has been regenerated for this project and CI now uses reproducible `npm ci`.

Detailed architecture: [Bass Mirror Engineering Spec](docs/BASS_MIRROR_ENGINEERING_SPEC_V0.1_TO_V1.md).

**Privacy/rights:** Only use audio you are authorized to work with; do not upload or redistribute protected stems. No recording is uploaded to a remote service. The Python worker is designed for local loopback access only; do not expose it to the internet.
