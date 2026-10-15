// Capture uncompressed microphone PCM instead of recording browser-specific
// WebM/MP4 and then asking decodeAudioData to decode that same container.
// Safari and Chromium can differ between MediaRecorder and Web Audio codecs.
const MAX_SECONDS = 60;

function encodeWav(chunks, totalFrames, sampleRate) {
  const buffer = new ArrayBuffer(44 + totalFrames * 2);
  const view = new DataView(buffer);
  const tag = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + totalFrames * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, totalFrames * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
      view.setInt16(offset, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function createMicrophoneRecorder() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture needs a supported browser and a secure (HTTPS) page.');
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('This browser does not support microphone audio capture.');

  // Unlock Web Audio on the actual Record button gesture, before the OS mic
  // permission dialog interrupts the gesture (notably on iOS Safari).
  const context = new AudioCtx();
  const initialResume = context.resume().catch(() => {});
  const chunks = [];
  let frames = 0;
  let stream;
  let source;
  let processor;
  let isWorklet = false;
  let flushDone = null;
  let disposed = false;

  const append = (samples) => {
    if (disposed || !samples?.length) return;
    const remaining = Math.floor(context.sampleRate * MAX_SECONDS) - frames;
    if (remaining <= 0) return;
    const copy = new Float32Array(samples.subarray(0, Math.min(samples.length, remaining)));
    chunks.push(copy);
    frames += copy.length;
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    try { processor?.disconnect(); } catch {}
    if (processor && 'onaudioprocess' in processor) processor.onaudioprocess = null;
    try { source?.disconnect(); } catch {}
    stream?.getTracks().forEach(track => track.stop());
    void context.close().catch(() => {});
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await initialResume;
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running') {
      throw new Error('The audio engine did not start. Tap Record again after enabling the microphone.');
    }
    source = context.createMediaStreamSource(stream);

    // Preferred: an AudioWorklet on the audio rendering thread. Its output is
    // intentionally silent, preventing microphone feedback through speakers.
    if (context.audioWorklet && typeof window.AudioWorkletNode !== 'undefined') {
      try {
        await context.audioWorklet.addModule(
          (import.meta.env.BASE_URL || '/') + 'pcm-capture-worklet.js'
        );
        processor = new window.AudioWorkletNode(context, 'offbeat-pcm-capture');
        processor.port.onmessage = ({ data }) => {
          if (data?.type === 'samples') append(data.samples);
          if (data?.type === 'flushed') flushDone?.();
        };
        source.connect(processor);
        processor.connect(context.destination);
        isWorklet = true;
      } catch {
        // Some embedded/older browsers block worklet module loading; use
        // the Web Audio fallback instead, never compressed MediaRecorder data.
        try { processor?.disconnect(); } catch {}
        try { source.disconnect(); } catch {}
        processor = null;
      }
    }

    if (!processor) {
      if (!context.createScriptProcessor) {
        throw new Error('Microphone PCM recording is unavailable in this browser.');
      }
      processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = event => {
        append(event.inputBuffer.getChannelData(0));
        event.outputBuffer.getChannelData(0).fill(0);
      };
      source.connect(processor);
      processor.connect(context.destination);
    }
  } catch (error) {
    cleanup();
    throw error;
  }

  let settled = false;
  return {
    mimeType: 'audio/wav',
    async stop() {
      if (settled) throw new Error('Recording already stopped.');
      settled = true;
      try {
        if (isWorklet) {
          // Include the final partial worklet block before closing audio.
          await Promise.race([
            new Promise(resolve => {
              flushDone = resolve;
              processor.port.postMessage({ type: 'flush' });
            }),
            new Promise(resolve => setTimeout(resolve, 350)),
          ]);
        }
        if (!frames) {
          throw new Error('The microphone captured no audio. Check mic permission and try recording again.');
        }
        return encodeWav(chunks, frames, context.sampleRate);
      } finally {
        cleanup();
      }
    },
    cancel() {
      if (settled) return;
      settled = true;
      cleanup();
    },
  };
}
