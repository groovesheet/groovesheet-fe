import { DEFAULT_FX, delaySeconds } from './fx';

/**
 * The stage-piano effects chain for the keys, in the order a Nord runs them:
 *
 *   in -> drive -> bass / treble shelves -> tremolo -> phaser -> out (dry)
 *                                                          |-> delay  -> out
 *                                                          '-> reverb -> out
 *
 * Delay and reverb are sends, so turning them up adds echo and space without
 * thinning the dry sound. Values are 0..1 from the knobs (see fx.js).
 */
export function createFxChain(ctx, destination) {
  const input = ctx.createGain();
  const out = ctx.createGain();
  out.connect(destination);

  // Amp: drive. Bypassed (no curve) at zero, so the clean sound stays clean.
  const drivePre = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';
  const driveMakeup = ctx.createGain();
  input.connect(drivePre);
  drivePre.connect(shaper);
  shaper.connect(driveMakeup);

  // EQ
  const bass = ctx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 220;
  const treble = ctx.createBiquadFilter();
  treble.type = 'highshelf';
  treble.frequency.value = 3200;
  driveMakeup.connect(bass);
  bass.connect(treble);

  // Effect 1: tremolo, an amplitude LFO
  const trem = ctx.createGain();
  const tremLfo = ctx.createOscillator();
  tremLfo.frequency.value = 4.8;
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0;
  tremLfo.connect(tremDepth);
  tremDepth.connect(trem.gain);
  tremLfo.start();
  treble.connect(trem);

  // Effect 2: phaser, four all-pass stages swept by a slow LFO, mixed with dry
  const phaserOut = ctx.createGain();
  trem.connect(phaserOut); // dry
  const phaserWet = ctx.createGain();
  phaserWet.gain.value = 0;
  const phLfo = ctx.createOscillator();
  phLfo.frequency.value = 0.35;
  phLfo.start();
  let stage = trem;
  for (let i = 0; i < 4; i += 1) {
    const ap = ctx.createBiquadFilter();
    ap.type = 'allpass';
    ap.frequency.value = 900;
    ap.Q.value = 0.6;
    const sweep = ctx.createGain();
    sweep.gain.value = 650;
    phLfo.connect(sweep);
    sweep.connect(ap.frequency);
    stage.connect(ap);
    stage = ap;
  }
  stage.connect(phaserWet);
  phaserWet.connect(phaserOut);
  phaserOut.connect(out);

  // Delay send, with damped feedback
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0;
  const delay = ctx.createDelay(1.2);
  const fbFilter = ctx.createBiquadFilter();
  fbFilter.type = 'lowpass';
  fbFilter.frequency.value = 3500;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  phaserOut.connect(delaySend);
  delaySend.connect(delay);
  delay.connect(fbFilter);
  fbFilter.connect(feedback);
  feedback.connect(delay);
  fbFilter.connect(out);

  // Reverb send: a convolver on a generated hall-ish impulse
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0;
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx, 2.8, 2.6);
  phaserOut.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(out);

  const ramp = (param, v) => param.setTargetAtTime(v, ctx.currentTime, 0.03);

  const SET = {
    drive: (v) => {
      if (v < 0.01) {
        shaper.curve = null;
        ramp(drivePre.gain, 1);
        ramp(driveMakeup.gain, 1);
        return;
      }
      shaper.curve = driveCurve(1 + v * 14);
      ramp(drivePre.gain, 1 + v * 2);
      ramp(driveMakeup.gain, 1 / (1 + v * 1.6));
    },
    treble: (v) => ramp(treble.gain, (v - 0.5) * 24),
    bass: (v) => ramp(bass.gain, (v - 0.5) * 24),
    tremolo: (v) => {
      ramp(tremDepth.gain, v * 0.45);
      ramp(trem.gain, 1 - v * 0.45);
    },
    phaser: (v) => ramp(phaserWet.gain, v),
    delay: (v) => ramp(delaySend.gain, v * 0.65),
    delayTime: (v) => ramp(delay.delayTime, delaySeconds(v)),
    reverb: (v) => ramp(reverbSend.gain, v * 1.1),
  };

  function set(id, value) {
    if (SET[id]) SET[id](Math.min(Math.max(value, 0), 1));
  }

  Object.entries(DEFAULT_FX).forEach(([id, v]) => set(id, v));

  return { input, set };
}

function driveCurve(k) {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

// Stereo noise with an exponential decay: a smooth, neutral hall tail.
function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i += 1) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
