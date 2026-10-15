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
previous_revision="$(git -C "$repo" rev-parse HEAD 2>>"$log" || true)"
revision_changed=0
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
current_revision="$(git -C "$repo" rev-parse HEAD 2>>"$log" || true)"
if [[ -n "$previous_revision" && "$current_revision" != "$previous_revision" ]]; then
  revision_changed=1
  print "Updated checkout: restarting owned local processes, preserving browser storage." >> "$log"
fi
stop_owned_port() {
  local port="$1" pid command_line working_directory
  pid="$(/usr/sbin/lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | /usr/bin/head -n 1 || true)"
  [[ -n "$pid" ]] || return 0
  command_line="$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)"
  working_directory="$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1 || true)"
  if [[ "$working_directory" != "$repo" && "$working_directory" != "$repo/analysis" ]]; then
    fail "Port $port is already used by another app. Offbeat won't stop someone else's process."
  fi
  if [[ "$port" == "8765" && "$command_line" != *uvicorn* ]] ||
     [[ "$port" == "5173" && "$command_line" != *vite* ]]; then
    fail "Port $port is in use by an unexpected local process. Offbeat won't stop it."
  fi
  /bin/kill "$pid" 2>>"$log" || fail "Could not restart the local process on port $port."
  for wait_count in {1..20}; do
    if ! /usr/sbin/lsof -nP -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then return 0; fi
    sleep .2
  done
  fail "The old process on port $port didn't stop; no other process was touched."
}
if [[ "$revision_changed" == "1" ]]; then
  stop_owned_port 8765
  stop_owned_port 5173
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
