# FORM 009 — Live sound recovery (October 18, 2026)

## Report
Real iPhone listener reported "sound is not working" despite prior desktop Chromium QA passing. Previous QA only validated DOM "PLAYING" state and offline WAV export; neither proves a real-time audio signal or a functioning device speaker.

## Changes
- Web Audio now opens/primes inside the actual user gesture, before asynchronous MP3 sample decoding. AudioContext is explicitly resumed and rechecked after decode to handle iOS/WebKit interruption. Errors provide usable retry guidance.
- Real audio output now passes through a Web Audio AnalyserNode, with a subtle real-time output-level meter rather than trusting a visual playhead.
- A user-activated **SOUND CHECK** synthesizes a short, clearly audible 392/588 Hz speaker-test tone, independent of MP3 samples and deep-bass speaker response. No paid service and no requirement to grant microphone access.
- FORM 009 labels SOUND / SIGNAL ACTIVE, BLOCKED, SUSPENDED, or TESTING. If browser signal is generated but listener hears silence, the remaining issue is likely phone volume, muted/silent mode or routing to a Bluetooth device; the meter cannot prove sound reached speakers.
- A new CI script `scripts/form_gesture_sound_smoke.py` runs genuine tap-based playback with no autoplay bypass, checks downstream audio signal instead of the UI label, and runs on Chromium and WebKit (Safari's engine). Existing musical and mobile smoke tests retained.

## What is / isn't verified
This improves and tests browser audio startup, session recovery and output generation. It cannot remotely measure physical audio on the user's iPhone or guarantee that a connected headset/speaker is unmuted.
