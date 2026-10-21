/** A synthesised purr (filtered noise pulsing ~25 times a second). Only used when sound is on. */
let ctx: AudioContext | null = null;
let node: { stop: () => void } | null = null;

export function startPurr() {
  if (node) return;
  try {
    ctx ??= new AudioContext();
    const c = ctx;
    const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    const gain = c.createGain();
    gain.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.frequency.value = 24;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(c.destination);
    gain.gain.setTargetAtTime(0.2, c.currentTime, 0.15);
    src.start();
    lfo.start();
    node = {
      stop: () => {
        gain.gain.setTargetAtTime(0, c.currentTime, 0.1);
        src.stop(c.currentTime + 0.4);
        lfo.stop(c.currentTime + 0.4);
      },
    };
  } catch {
    node = null;
  }
}

export function stopPurr() {
  node?.stop();
  node = null;
}
