# OFFBEAT — Finder launch without Terminal

The OFFBEAT Mac launcher is a lightweight **AppleScript Finder app** for
an existing local checkout. It is not a cloud deployment, and neither the
microphone nor the Python analysis engine uploads audio to a hosted service.

## Use
- Your existing local checkout can remain at ~/offbeat. The launcher finds
  this location or lets you choose the folder from Finder.
- Download **OFFBEAT-Launcher-macOS** from a successful run of the
  [Mac Launcher GitHub Actions workflow](https://github.com/amydojo/offbeat/actions/workflows/mac-launcher.yml).
- Unzip, then right-click **OFFBEAT Launcher.app** and choose **Open** on
  its first run. As an ad-hoc signed **unnotarized** prototype, macOS may
  prompt you to allow the app through Privacy & Security. Do not disable
  Gatekeeper globally.
- It safely fast-forwards a clean checkout of main when GitHub is available,
  starts the Python worker and Vite frontend on loopback, and opens
  http://127.0.0.1:5173 in your default browser.
- Dependencies are installed only when absent. If macOS is missing Node,
  FFmpeg or compatible Python, a dialog explains the blocker instead of
  silently deleting or overwriting work.

## Notes
- This still uses two background local processes; it removes the manual
  Terminal steps, **not** the underlying Python/Node architecture.
- Closing your browser does not stop these background processes. Logging out
  or restarting the computer will stop them. Startup won't duplicate a
  healthy running service.
- Local recordings saved to IndexedDB are scoped to the **exact browser
  origin**. Existing sessions made at http://localhost:5173 are **not**
  visible at http://127.0.0.1:5173 and vice versa. Use the same address
  and browser profile you used when saving. Never clear browsing data to
  "fix" this difference.
- Diagnostic logs are kept in ~/Library/Logs/Offbeat.
- The workflow compiles/validates the app on a GitHub-hosted Mac. That **is
  not a substitute for testing the user's own Mac**, browser, permissions
  and audio interface.
- This is a convenience prototype, not a notarized or self-contained app;
  the checkout and common developer runtime dependencies still need to be
  present. Do not redistribute as a finished consumer install.
