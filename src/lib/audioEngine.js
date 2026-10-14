import * as Tone from 'tone';

// Demo-loop bus only. Microphone recording lives in audio/microphoneRecorder.js.
const players = new Map();
let starting = new Set();

export async function playLoop(id, url) {
  if (players.has(id) || starting.has(id)) return;
  starting.add(id);
  let player;
  try {
    await Tone.start();
    player = new Tone.Player({ url, loop: true, autostart: false }).toDestination();
    await Tone.loaded();
    // Stop may have been requested while the file was loading.
    if (!starting.has(id)) { player.dispose(); return; }
    players.set(id, player);
    player.start();
  } catch (error) {
    if (player) player.dispose();
    throw error;
  } finally {
    starting.delete(id);
  }
}

export function stopLoop(id) {
  starting.delete(id);
  const player = players.get(id);
  if (!player) return;
  try { player.stop(); } finally { player.dispose(); players.delete(id); }
}

export function stopAll() {
  for (const id of [...starting]) starting.delete(id);
  for (const id of [...players.keys()]) stopLoop(id);
}

export function isLoopPlaying(id) { return players.has(id); }
