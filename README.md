# OFFBEAT — Bass Mirror

An ear-first, mobile-first instrument for catching music you hum or play. **V0.2 GROOVE experience:** capture → on-device pitch contour → optional reference comparison → A/B listening → Keep → local portable project backup. Responsive drums remain V0.2.

**Live web app:** https://offbeat-pi.vercel.app

**New in V0.2:** [responsive Follow / Answer / Contrast drummer](docs/GROOVE_V02.md), generated kick/snare/hat loop playback, controlled density/response/swing, tap tempo, seeded variations, local mixed PCM WAV export, and deterministic pattern recipes included in portable saved projects. The original source stays unquantized.


## Product rules
- No grades, forced note names, notation drills or judgments about musical intention.
- The mobile site is a static Vite app hosted on Vercel. Audio is decoded, analyzed and compared locally in your browser by Web Audio and a dedicated Web Worker; no Python server is required to use the public app.
- Microphone permission is requested only after you tap **Record or hum**. A short recording is automatically analyzed after Stop; imported files use **Analyze shape**.
- On-device pitch/onset estimates are experimental and confidence is **not calibrated**. Silence and uncertain frames remain gaps; matched attacks indicate timing proximity, not identical melodies.
- Click **Keep this phrase** to save source audio and analysis locally in your browser's IndexedDB. Files are scoped to that device/browser/origin and can be lost if site data is cleared.
- **Export project** creates a user-triggered, portable backup containing original audio and analysis. **Import project backup** verifies the original audio checksum (SHA-256) before creating a new local saved session. Mobile export is limited to 12 MB aggregate source audio / 20 MB JSON; larger recordings can be saved separately using **Download original**.
- Backups are **not encrypted**, not automatically synchronized and not sent to Vercel by OFFBEAT. Store exported files according to your privacy preferences.

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

Open **http://localhost:5173**. Start with the microphone or import **Your take**, then optionally add a Reference; comparison never requires a reference to save your take. Browser native `<audio>` players let you audition each original at its own timing.

The default browser analysis does not require Python. Only development/research sessions explicitly configured with `VITE_ANALYSIS_MODE=python` use the optional localhost FastAPI engine. No subscriptions, GPUs or secret keys required.

## Tests and known limitations

```sh
npm run build
cd analysis
python -m pytest
```

Default browser limits: 25 MB original source file, 55 seconds for extracted excerpts from files longer than 60 seconds (full files up to 60 seconds are analyzed intact), approximate 36–650 Hz monophonic pitch; audio formats vary by browser. The optional local Python engine has its own bounded FFmpeg decoder. Onset boundaries, high harmonics, low E bass and noisy recordings require careful listening checks. YIN is a DSP baseline; no pretrained models run. The versioned `/v1/compare` reports aligned attack correspondences, source timing and nonjudgmental contour descriptors. Use **Find the moment in the reference** to select and preview a reference excerpt close to your performance's length; a 54-second song is no longer force-matched with a 13-second hum. Attack matches represent proximity in time **only** and do not establish the same notes or riff. Sparse inputs can produce weak or misleading matches; use the original-time view to verify. For voice performances choose **Humming** as the take's source type and reanalyze.

**Mobile DSP V0.1.1:** An on-device YIN-style pitch tracker with improved short-window attack/rest timing and conservative octave-glitch gaps replaces the initial browser autocorrelation peak selector. See [synthetic regression scope and remaining real-phone QA](docs/BROWSER_DSP_CALIBRATION_V011.md). These synthetic tests do **not** establish measured accuracy on real voices/bass. Source analysis records adapter provenance; older saved analyses remain unchanged.

**Portable projects:** [mobile backup/import format, integrity checks and limitations](docs/PORTABLE_PROJECTS_V1.md).

**Mac hardware checklist:** [physical-device and Safari QA](docs/MAC_MICROPHONE_QA.md) must be completed by someone with the actual Mac. Linux Chromium CI only exercises a fake microphone.

**Follow-up quality gates:** A locked Python environment (`uv.lock`), full screen-reader/accessibility audit, local-worker session-token hardening, and optional PESTO remain planned; see [issues](https://github.com/amydojo/offbeat/issues/1). The npm dependency lockfile has been regenerated for this project and CI now uses reproducible `npm ci`.

Detailed architecture: [Bass Mirror Engineering Spec](docs/BASS_MIRROR_ENGINEERING_SPEC_V0.1_TO_V1.md).

**Privacy/rights:** Only use audio you are authorized to work with; do not upload or redistribute protected stems. No recording is uploaded to a remote service. The Python worker is designed for local loopback access only; do not expose it to the internet.

**Long imports:** Clips over 60 seconds are decoded locally; OFFBEAT automatically analyzes the most active 55-second window. Use the analysis excerpt slider beside each recording to pick another window and press **Analyze shape** again. Playback, A/B and drum export seek into the intact original at the chosen source offset. The full original is preserved in local sessions and downloads; existing 12 MB portable-backup limit still applies. On-device processing of longer files depends on browser memory and CPU.
