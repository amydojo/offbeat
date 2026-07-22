import * as Tone from 'tone';

const loops = {};
const recorder = new Tone.Recorder();

export async function playLoop(id, url) {
  if (loops[id]) return;
  const player = new Tone.Player({ url, loop: true, autostart: true }).toDestination();
  // Connect to recorder
  Tone.Destination.connect(recorder);
  loops[id] = player;
}

export function stopLoop(id) {
  if (loops[id]) {
    loops[id].stop();
    delete loops[id];
  }
}

export async function startRecording() {
  await Tone.start();
  recorder.start();
}

export async function stopRecording() {
  const recording = await recorder.stop();
  const url = URL.createObjectURL(recording);
  return url;
}

export function stopAll() {
  Object.keys(loops).forEach((id) => {
    loops[id].stop();
    delete loops[id];
  });
}
