# Local Python listening engine (first slice)

This worker analyzes files after capture. It is never a live audio transport or microphone listener.

## Run (macOS, Python 3.11–3.13)

Install FFmpeg (`brew install ffmpeg`). From `analysis/`:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
python -m uvicorn offbeat.api:app --host 127.0.0.1 --port 8765
```

In another terminal from the repo root: `npm install && npm run dev`. Python workers and browser are separate processes; the frontend gives a useful error when the worker is not started. No OpenAI API key, cloud or GPU required.

Run tests: `python -m pytest analysis/tests` from repository root with the `analysis` package installed, or `python -m pytest tests` from `analysis/`.

**Limits:** maximum 25 MB / 60 seconds, stereo downmixed for analysis, maximum one file per request, baseline YIN on isolated bass/humming. Results are estimates with *uncalibrated* pitch confidence. Mixed commercial tracks and polyphonic music may not yield meaningful contours. The Python server returns no authoritative tempo or transcription. Comparison intentionally returns a 501 until BM-09.

**Privacy:** server binds to loopback only, processes uploaded bytes in an automatically deleted temporary directory, makes no network inference calls, and does not save audio or logs. The browser retains the original recording as an object URL for the session. Saved favorites and user corrections are later release gates. Do not expose port 8765 over a public tunnel.

**Known follow-up:** a reproducible `uv.lock` and a fully audited local session token are part of BM-02/BM-05 hardening; this initial runtime is a working DSP slice, not production distribution.
