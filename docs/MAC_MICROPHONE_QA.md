# OFFBEAT V0.1 — physical Mac and Safari acceptance

**Status:** MANUAL DEVICE SIGN-OFF REQUIRED. GitHub-hosted Linux Chromium can run a
synthetic microphone fixture; that is **not** evidence your own Mac microphone,
external audio interface, or Safari has been exercised.

## Setup

1. On the Mac: `brew install ffmpeg` and `npm ci` in the project root.
2. Run `npm run dev` in one terminal. In a second terminal run
   `cd analysis && python3 -m venv .venv && source .venv/bin/activate && python -m pip install -e '.[dev]' && python -m uvicorn offbeat.api:app --host 127.0.0.1 --port 8765`.
3. Navigate to **http://127.0.0.1:5173**, not a hosted Vercel page.
   The local worker cannot be reached from a remote browser.
4. Use a recording you own; do not commit third-party stems or private microphone samples.

## Physical-microphone test matrix (check each manually)

- [ ] Safari current macOS: **Record bass** prompts only after clicking. Grant access,
      play 3 seconds, Stop, verify clip exists and is audible in embedded player.
- [ ] Safari: stop/record repeatedly without duplicated audio or live permission indicator
      after stopping; deny permission once and verify readable recovery text.
- [ ] Chrome Mac: same recording/stop scenario; verify actual container (typically
      `audio/mp4` Safari or `audio/webm` Chrome), not a fake WAV extension.
- [ ] Built-in Mac microphone: hold sustained bass note and pluck 4 times; analyze; contour
      must include discontinuities over real silence, not fabricated notes.
- [ ] External audio interface, if available: select it in browser/macOS input settings,
      record with headphones to prevent feedback, verify input level and pitch range.
- [ ] Safari/Chrome file import: WAV plus one phone-generated M4A; confirm
      `/v1/audio/analyze` either succeeds locally or gives a precise decoder error.
- [ ] Reference and your take at different tempos: run Compare; switch Original / Align
      the shapes; verify no audio playback is time-stretched unexpectedly.
- [ ] Keyboard: Tab to start/end sliders, Arrow keys move selection; alternate A/B,
      repeat, Stop; listen for gaps, playback bursts, stuck/duplicate audio.
- [ ] Select a 1–2 second riff; **Keep this phrase**; reload; Open; verify exact source
      pitch shape and audio, then Delete; confirm item and audio are removed.
- [ ] Deny mic + offline: pre-imported audio and saved sessions still playable; no API
      provider is contacted; Python-offline state yields a useful message.
- [ ] Verify reduced-motion, a mobile-sized viewport, screen reader contour summary and
      adequate contrast / hit targets.

Record actual **macOS version, Mac hardware, browser version, input device, pass/fail,
measured CPU latency, and exact problematic audio files' formats**. Keep sensitive
audio samples out of public issue comments.

## Out-of-scope and known limitations

The current baseline YIN pitch detector does not report calibrated pitch confidence;
low E1 notes and harmonics may produce octave errors. A/B is sequential and maps
corresponding selected time ranges; it does not play the two different-tempo sources
simultaneously or change their original samples. No cloud synchronization or generated
drums in V0.1. A full accessibility audit and PESTO adapter remain future gates.

**Release rule:** Do not call this device-validated until every applicable check above
has actually been performed on a physical Mac. Linux Chromium browser automation
is valuable but separate.
