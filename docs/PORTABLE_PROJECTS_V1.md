# OFFBEAT portable project backup V1 (V0.1.3)

## What it solves
The production Vercel domain, an iPhone Safari profile and a desktop Chrome profile
have separate IndexedDB stores. Saved phrases do not magically sync.
The user now chooses **Export project** from Keep, saves a `.offbeat.json` file
to Files/Downloads, then selects **Import project backup** on another device.
This is local browser processing, not cloud storage, analytics or an API request.

## Format
`offbeat.backup.v1` JSON includes an exported timestamp, session title and
non-destructive selection, original reference/take audio byte streams in
base64, original analysis documents and the compatible comparison if present.
Each original has SHA-256 recorded. Import verifies the complete byte stream
and checks the saved analysis source hash before creating a new session ID.
Tampered or unsupported versions are rejected without writing to IndexedDB.

## Safety and known limitations
- **Not encrypted.** Audio appears in the exported file; users control where it is stored.
- Export limit: 12 MiB aggregate source bytes and 20 MiB resulting JSON. The
  large backing strings use additional memory; on low-memory mobile browsers
  use **Download original** instead and retry when device resources allow.
- Downloads can be saved or opened differently by Safari, Chrome and each
  platform's Files app. Real iPhone/Android QA is pending under #26.
- OFFBEAT does not upload, synchronize or back up recordings automatically.
  Clearing site data may irreversibly delete local projects not exported.
- Import creates a **new local ID** to avoid accidentally overwriting any
  saved session. Comparison is restored only if its analysis IDs match.
- Imported historical analyses retain their original model/adapter metadata,
  rather than silently re-running a new algorithm on the file.
- No compressed archive, batch library migration, password protection,
  format upgrade wizard or conflict resolution is implemented yet.

## Automated validation
- Node roundtrip test verifies original bytes, source analysis and selection.
- Invalid version, oversized source, and tampered source bytes are rejected.
- Chromium emulated mobile browser test performs:
  Save → Export → Delete → Import → Reload → Open, plus a tampered import that
  must not add an entry. This is not physical Safari or Android testing.
- No new network request, third-party dependency or server function is needed.

## GROOVE V0.2 extension
New backups MAY include an optional \`session.groove\` object with the
\`offbeat.groove.v1\` version, mode, deterministic seed, response settings,
source SHA-256/analysis ID, source-relative selection and drum event list.
Imports verify the groove recipe against the verified take analysis before
retaining it. Invalid or mismatched recipes are ignored; the original audio
and analysis remain importable. Legacy backups without this optional field
remain compatible. Audio files themselves are never modified.

The separate **Export mixed WAV** action renders the selected original take
and deterministic drum events to an actual mono 22,050 Hz / 16-bit PCM WAV.
That WAV is not a portable multitrack project or an MP3. Export is bounded to
a 16-second phrase to protect mobile memory.
