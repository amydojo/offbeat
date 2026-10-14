// Explicit microphone path; never records the Tone.js playback bus.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/webm',
];

export async function createMicrophoneRecorder() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Microphone capture is not supported in this browser.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  let recorder;
  try {
    const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  let settled = false;
  let recordingError = null;
  const chunks = [];
  const cleanup = () => stream.getTracks().forEach((track) => track.stop());
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data?.size) chunks.push(event.data);
  });
  recorder.addEventListener('error', (event) => {
    recordingError = event.error || new Error('Audio recording failed.');
  });
  try { recorder.start(250); } catch (error) { cleanup(); throw error; }
  return {
    mimeType: recorder.mimeType,
    stop() {
      if (settled) return Promise.reject(new Error('Recording already stopped.'));
      settled = true;
      return new Promise((resolve, reject) => {
        recorder.addEventListener('stop', () => {
          cleanup();
          if (recordingError) return reject(recordingError);
          const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' });
          if (!blob.size) return reject(new Error('The microphone captured no audio.'));
          resolve(blob);
        }, { once: true });
        try { recorder.stop(); } catch (error) { cleanup(); reject(error); }
      });
    },
    cancel() {
      if (settled) return;
      settled = true;
      try { if (recorder.state !== 'inactive') recorder.stop(); } finally { cleanup(); }
    },
  };
}
