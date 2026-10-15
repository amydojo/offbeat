# OFFBEAT mobile / Vercel deployment

Vercel serves a **static Vite application**. The browser decodes audio with Web Audio and estimates pitch, attacks and rests in a background Web Worker. Comparing phrases is also local. No Python or FFmpeg is deployed, and raw microphone recordings are not uploaded.

## Limitations
- Browser audio codec support differs on Safari/Chrome. Phone-recorded formats need device QA.
- On-device autocorrelation pitch detection is approximate, especially for low bass, noisy voice and harmonics. Do not represent estimates as scored musical correctness.
- Maximum audio duration stays 60s; original files remain unchanged.
- Existing desktop sessions in IndexedDB at localhost:5173 do NOT appear on *.vercel.app. No automatic audio migration or cloud syncing; do not clear site data.
- HTTPS microphone access requires user consent on the phone. No background recording.
- Real iPhone Safari testing still pending; emulated Chromium is not the same.

## Deployment
Link GitHub amydojo/offbeat to a Vercel Vite project. Set build to npm run build, output dist. Do not enable VITE_ANALYSIS_MODE=python; that is the optional localhost desktop engine.
All audio processing and the local phrase library run in browser on the user's device. No serverless endpoint is needed. Do not upload copyrighted stems to public shared sources.
