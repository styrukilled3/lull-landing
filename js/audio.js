let ctx = null;
let master = null;
let lp = null;
let muted = true;

function init() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = 0;
  lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  lp.Q.value = 0.4;
  master.connect(lp);
  lp.connect(ctx.destination);

  // slow sine pad built around 432 Hz, each voice breathes on its own LFO
  [[216, 0.05], [324, 0.035], [432, 0.045], [648, 0.018]].forEach(([f, g], i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 4;
    const og = ctx.createGain();
    og.gain.value = g;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.03;
    const lg = ctx.createGain();
    lg.gain.value = g * 0.6;
    lfo.connect(lg);
    lg.connect(og.gain);
    o.connect(og);
    og.connect(master);
    o.start();
    lfo.start();
  });

  // brown noise, low passed: distant wind
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 500;
  const ng = ctx.createGain();
  ng.gain.value = 0.18;
  src.connect(nf);
  nf.connect(ng);
  ng.connect(master);
  src.start();
  return true;
}

// returns true when playing, false when muted, null when audio is unavailable
export function toggle() {
  if (!ctx && !init()) return null;
  if (ctx.state === 'suspended') ctx.resume();
  muted = !muted;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(muted ? 0 : 0.9, t, 0.6);
  return !muted;
}

export function setMuffled(on) {
  if (!lp) return;
  lp.frequency.setTargetAtTime(on ? 380 : 3200, ctx.currentTime, 0.5);
}
