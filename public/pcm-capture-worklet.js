// Standard AudioWorkletProcessor. This is served as a static same-origin asset.
class OffbeatPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batch = new Float32Array(4096);
    this.used = 0;
    this.active = true;
    this.port.onmessage = ({ data }) => {
      if (data?.type !== 'flush') return;
      this.active = false;
      this.send();
      this.port.postMessage({ type: 'flushed' });
    };
  }

  send() {
    if (!this.used) return;
    const samples = this.used === this.batch.length
      ? this.batch
      : this.batch.slice(0, this.used);
    this.port.postMessage({ type: 'samples', samples }, [samples.buffer]);
    this.batch = new Float32Array(4096);
    this.used = 0;
  }

  process(inputs) {
    if (!this.active) return true;
    const mono = inputs[0]?.[0];
    if (!mono) return true;
    for (let i = 0; i < mono.length; i++) {
      this.batch[this.used++] = mono[i];
      if (this.used === this.batch.length) this.send();
    }
    // Leave the output zero-filled: no mic signal goes to the speakers.
    return true;
  }
}

registerProcessor('offbeat-pcm-capture', OffbeatPcmCapture);
