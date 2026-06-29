let audioContext: AudioContext | null = null;

const MASTER_GAIN = 0.13;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/** Pink-ish paper texture noise (more natural than raw white). */
function createPaperNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
  }
  return buffer;
}

/** Realistic page-turn foley synthesized in Web Audio. */
export class PageFlipSoundController {
  private paperBuffer: AudioBuffer | null = null;

  private getPaperBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.paperBuffer) {
      this.paperBuffer = createPaperNoiseBuffer(ctx, 0.55);
    }
    return this.paperBuffer;
  }

  playTurn() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const jitter = Math.random() * 0.018;
    const t0 = now + jitter;
    const pan = (Math.random() - 0.5) * 0.35;

    const master = ctx.createGain();
    master.gain.setValueAtTime(MASTER_GAIN, t0);
    master.connect(ctx.destination);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, t0);
    panner.connect(master);

    const buf = this.getPaperBuffer(ctx);
    const offset = Math.random() * 0.08;

    // 1. Initial page lift — crisp edge scrape
    {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 1.05 + Math.random() * 0.15;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200 + Math.random() * 400, t0);
      filter.Q.setValueAtTime(1.4, t0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.28, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      src.start(t0, offset, 0.06);
      src.stop(t0 + 0.07);
    }

    // 2. Main swish — sweeping bandpass mimics air + paper flex
    {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.88 + Math.random() * 0.1;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, t0 + 0.01);
      filter.frequency.exponentialRampToValueAtTime(480, t0 + 0.34);
      filter.Q.setValueAtTime(0.85, t0 + 0.01);
      filter.Q.linearRampToValueAtTime(0.45, t0 + 0.34);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0.72, t0 + 0.035);
      gain.gain.setValueAtTime(0.55, t0 + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      src.start(t0 + 0.01, offset + 0.02, 0.36);
      src.stop(t0 + 0.38);
    }

    // 3. Flutter pulses — paper creasing mid-turn
    const flutterTimes = [0.09, 0.16, 0.24];
    flutterTimes.forEach((delay, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.92 + i * 0.06 + Math.random() * 0.08;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(900 + i * 180, t0 + delay);
      filter.Q.setValueAtTime(0.6, t0 + delay);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.linearRampToValueAtTime(0.14 + i * 0.04, t0 + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.07);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      src.start(t0 + delay, offset + 0.05 + i * 0.03, 0.08);
      src.stop(t0 + delay + 0.09);
    });

    // 4. Soft body thump on landing
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(118 + Math.random() * 12, t0 + 0.28);
      osc.frequency.exponentialRampToValueAtTime(52, t0 + 0.42);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, t0 + 0.28);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0 + 0.28);
      gain.gain.linearRampToValueAtTime(0.42, t0 + 0.285);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.44);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      osc.start(t0 + 0.28);
      osc.stop(t0 + 0.45);
    }

    // 5. Settle rustle — paper flattening against stack
    {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.78;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680, t0 + 0.3);
      filter.frequency.exponentialRampToValueAtTime(320, t0 + 0.42);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0 + 0.3);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.31);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.44);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      src.start(t0 + 0.3, offset + 0.15, 0.14);
      src.stop(t0 + 0.45);
    }

    // 6. Very subtle room tail
    {
      const delay = ctx.createDelay(0.08);
      delay.delayTime.setValueAtTime(0.028 + Math.random() * 0.012, t0 + 0.28);

      const feedback = ctx.createGain();
      feedback.gain.setValueAtTime(0.12, t0 + 0.28);

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(0.08, t0 + 0.28);

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t0 + 0.28);

      src.connect(filter);
      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(panner);
      src.start(t0 + 0.28, offset + 0.2, 0.06);
      src.stop(t0 + 0.36);
    }
  }

  cancel() {
    /* one-shot sources */
  }
}

export const pageFlipSound = new PageFlipSoundController();
