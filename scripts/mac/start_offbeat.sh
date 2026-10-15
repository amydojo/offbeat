#!/bin/zsh
# OFFBEAT local-only launcher; prints friendly errors for the Finder app.
set -eu
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
for nodebin in "$HOME"/.nvm/versions/node/*/bin(N); do
  [[ -x "$nodebin/node" ]] && export PATH="$nodebin:$PATH"
done
export GIT_TERMINAL_PROMPT=0
repo="${1:-$HOME/offbeat}"
logs="$HOME/Library/Logs/Offbeat"
mkdir -p "$logs"
log="$logs/launcher.log"
print -r -- "--- Launch $(date) ---" >> "$log"
fail() {
  print -r -- "$1" >> "$log"
  print -u2 -r -- "$1
Your files and recordings have not been deleted. Log: $log"
  exit 1
}
[[ -f "$repo/package.json" && -f "$repo/analysis/offbeat/api.py" ]] || fail "This folder doesn't contain the Offbeat project."
if [[ "${OFFBEAT_LAUNCHER_CHECK_ONLY:-0}" == "1" ]]; then
  print "OFFBEAT_PREFLIGHT_OK"
  exit 0
fi
if [[ -d "$repo/.git" ]] && [[ -z "$(git -C "$repo" status --porcelain --untracked-files=no 2>>"$log")" ]]; then
  if git -C "$repo" fetch --quiet origin main >>"$log" 2>&1; then
    if git -C "$repo" switch --quiet main >>"$log" 2>&1; then
      git -C "$repo" merge --ff-only --quiet origin/main >>"$log" 2>&1 || print "Update skipped (not fast-forwardable)." >> "$log"
    fi
  else
    print "Offline or GitHub unavailable; using the installed checkout." >> "$log"
  fi
else
  print "Update skipped; your local tracked changes are preserved." >> "$log"
fi
command -v npm >/dev/null 2>&1 || fail "Node.js/npm is missing. Offbeat needs Node 22."
command -v ffmpeg >/dev/null 2>&1 || fail "FFmpeg is missing from PATH."
if [[ ! -x "$repo/node_modules/.bin/vite" ]]; then
  (cd "$repo" && npm ci --no-audit --no-fund >>"$log" 2>&1) || fail "Unable to prepare the Offbeat frontend."
fi
python="$repo/analysis/.venv/bin/python"
if [[ ! -x "$python" ]]; then
  if command -v python3.11 >/dev/null 2>&1; then basepython="$(command -v python3.11)"
  elif command -v python3.12 >/dev/null 2>&1; then basepython="$(command -v python3.12)"
  else fail "Python 3.11 or 3.12 is needed for the local listening engine."
  fi
  "$basepython" -m venv "$repo/analysis/.venv" >>"$log" 2>&1 || fail "Could not create a Python environment."
  (cd "$repo/analysis" && "$python" -m pip install -e '.[dev]' >>"$log" 2>&1) || fail "Could not prepare the Python audio engine."
fi
if ! /usr/bin/curl -fsS --max-time 1 http://127.0.0.1:8765/health >/dev/null 2>&1; then
  (cd "$repo/analysis" && nohup "$python" -m uvicorn offbeat.api:app --host 127.0.0.1 --port 8765 >> "$logs/python.log" 2>&1 < /dev/null &)
fi
if ! /usr/bin/curl -fsS --max-time 1 http://127.0.0.1:5173/ >/dev/null 2>&1; then
  (cd "$repo" && nohup npm run dev -- --host 127.0.0.1 >> "$logs/frontend.log" 2>&1 < /dev/null &)
fi
for attempt in {1..45}; do
  if /usr/bin/curl -fsS --max-time 1 http://127.0.0.1:8765/health >/dev/null 2>&1 &&
     /usr/bin/curl -fsS --max-time 1 http://127.0.0.1:5173/ >/dev/null 2>&1; then
    print "OFFBEAT_READY"
    exit 0
  fi
  sleep 1
done
fail "The local services couldn't start. Check the diagnostic logs."
