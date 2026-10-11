/**
 * Intro soundtrack, synthesised live with the Web Audio API (no audio files to download).
 * Every sound is scheduled at a time (seconds) on the intro timeline.
 */
export type IntroCue = { at: number; play: (t: number) => void };

export function createIntroAudio() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(comp).connect(ctx.destination);

  // 2 s of white noise, reused by every noisy sound
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const drive = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / curve.length) * 2 - 1;
    curve[i] = Math.tanh(x * 3);
  }
  drive.curve = curve;
  drive.connect(master);

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  const whoosh = (t: number, dur: number, from: number, to: number, vol: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    env(g, t, vol, dur * 0.75, dur * 0.35);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.4);
  };

  const riser = (t: number, dur: number) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    osc.connect(lp).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.1);
    whoosh(t, dur, 300, 5000, 0.35);
  };

  const boom = (t: number, vol = 1, high = 150, low = 38, decay = 1.5) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(high, t);
    osc.frequency.exponentialRampToValueAtTime(low, t + 0.5);
    const g = ctx.createGain();
    env(g, t, vol, 0.008, decay);
    osc.connect(g).connect(drive);
    osc.start(t);
    osc.stop(t + decay + 0.1);

    // Transient "crack"
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.35);
    const ng = ctx.createGain();
    env(ng, t, vol * 0.7, 0.004, 0.35);
    src.connect(lp).connect(ng).connect(master);
    src.start(t);
    src.stop(t + 0.5);
  };

  const shimmer = (t: number) => {
    [659.25, 987.77, 1318.5, 1975.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      env(g, t + i * 0.07, 0.07, 0.01, 0.9);
      o.connect(g).connect(master);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 1);
    });
  };

  // Timeline (seconds) — matches the CSS keyframe timings in globals.css (.px-intro)
  const cues: IntroCue[] = [
    { at: 0.1, play: (t) => riser(t, 1.05) },
    { at: 1.18, play: (t) => boom(t, 1) },
    { at: 1.3, play: (t) => shimmer(t) },
    { at: 2.05, play: (t) => boom(t, 0.55, 110, 45, 0.45) },
    { at: 2.9, play: (t) => boom(t, 0.6, 110, 45, 0.45) },
    { at: 4.0, play: (t) => whoosh(t, 0.6, 2500, 180, 0.5) },
    { at: 4.1, play: (t) => boom(t, 0.35, 80, 32, 0.9) },
  ];

  let started = false;
  return {
    ctx,
    /** Starts every cue that is still in the future, given how far the visual timeline has run. */
    async start(elapsed: number) {
      if (started) return true;
      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {}
      if (ctx.state !== "running") return false;
      started = true;
      const now = ctx.currentTime;
      for (const c of cues) if (c.at >= elapsed - 0.05) c.play(now + Math.max(0, c.at - elapsed));
      return true;
    },
    fadeOut() {
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => ctx.close(), 600);
      } catch {}
    },
  };
}
