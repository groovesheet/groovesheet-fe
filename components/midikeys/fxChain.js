import { DEFAULT_FX, delaySeconds, lowpassHz, modRateScale } from './fx';

/**
 * The stage-piano effects chain for the keys, in the order a Nord runs them:
 *
 *   in -> drive -> bass/treble -> low-pass -> compressor -> tremolo -> ring mod
 *      -> auto-pan -> phaser -> chorus + flanger -> out (dry)
 *                                              |-> delay  -> out
 *                                              '-> reverb -> out
 *
 * Every stage is transparent at its default, so the clean sound stays clean.
 * Delay and reverb are sends, so they add echo and space without thinning the
 * dry sound. The Rate knob scales all the modulation LFOs together. Values
 * are 0..1 from the knobs (see fx.js).
 */

// Each LFO's speed at Rate 1x.
const BASE_HZ = { tremolo: 4.8, phaser: 0.35, chorus: 0.7, flanger: 0.18, pan: 1.2, ring: 220 };

export function createFxChain(ctx, destination) {
  const input = ctx.createGain();
  const out = ctx.createGain();
  out.connect(destination);
  const lfos = {};
  const lfo = (name, shape = 'sine') => {
    const o = ctx.createOscillator();
    o.type = shape;
    o.frequency.value = BASE_HZ[name];
    o.start();
    lfos[name] = o;
    return o;
  };

  // Amp: drive. Bypassed (no curve) at zero.
  const drivePre = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';
  const driveMakeup = ctx.createGain();
  input.connect(drivePre);
  drivePre.connect(shaper);
  shaper.connect(driveMakeup);

  // EQ, then the low-pass filter
  const bass = ctx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 220;
  const treble = ctx.createBiquadFilter();
  treble.type = 'highshelf';
  treble.frequency.value = 3200;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.9;
  driveMakeup.connect(bass);
  bass.connect(treble);
  treble.connect(lowpass);

  // Compressor: ratio 1 and threshold 0 dB at zero, i.e. off
  const comp = ctx.createDynamicsCompressor();
  comp.knee.value = 12;
  comp.attack.value = 0.006;
  comp.release.value = 0.2;
  const compMakeup = ctx.createGain();
  lowpass.connect(comp);
  comp.connect(compMakeup);

  // Effect 1: tremolo (amplitude LFO)
  const trem = ctx.createGain();
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0;
  lfo('tremolo').connect(tremDepth);
  tremDepth.connect(trem.gain);
  compMakeup.connect(trem);

  // Effect 1: ring modulator, the signal multiplied by a carrier, mixed with dry
  const ringOut = ctx.createGain();
  const ringDry = ctx.createGain();
  const ringMul = ctx.createGain();
  ringMul.gain.value = 0; // the carrier alone drives this gain
  const ringWet = ctx.createGain();
  ringWet.gain.value = 0;
  lfo('ring').connect(ringMul.gain);
  trem.connect(ringDry);
  trem.connect(ringMul);
  ringMul.connect(ringWet);
  ringDry.connect(ringOut);
  ringWet.connect(ringOut);

  // Effect 1: auto-pan
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  const panDepth = ctx.createGain();
  panDepth.gain.value = 0;
  lfo('pan').connect(panDepth);
  if (panner.pan) panDepth.connect(panner.pan);
  ringOut.connect(panner);

  // Effect 2: phaser, four all-pass stages swept by a slow LFO, mixed with dry
  const phaserOut = ctx.createGain();
  panner.connect(phaserOut);
  const phaserWet = ctx.createGain();
  phaserWet.gain.value = 0;
  const phLfo = lfo('phaser');
  let stage = panner;
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

  // Effect 2: chorus and flanger, both parallel to the dry signal
  const modOut = ctx.createGain();
  phaserOut.connect(modOut);
  const chLfo = lfo('chorus');
  const chorusWet = ctx.createGain();
  chorusWet.gain.value = 0;
  [[0.018, 0.0025, -0.7], [0.026, -0.0025, 0.7]].forEach(([base, sway, pan]) => {
    const d = ctx.createDelay(0.05);
    d.delayTime.value = base;
    const depth = ctx.createGain();
    depth.gain.value = sway;
    chLfo.connect(depth);
    depth.connect(d.delayTime);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = pan;
    phaserOut.connect(d);
    d.connect(p);
    p.connect(chorusWet);
  });
  chorusWet.connect(modOut);

  const flDelay = ctx.createDelay(0.02);
  flDelay.delayTime.value = 0.003;
  const flDepth = ctx.createGain();
  flDepth.gain.value = 0.0025;
  lfo('flanger', 'triangle').connect(flDepth);
  flDepth.connect(flDelay.delayTime);
  const flFeedback = ctx.createGain();
  flFeedback.gain.value = 0.65;
  const flangerWet = ctx.createGain();
  flangerWet.gain.value = 0;
  phaserOut.connect(flDelay);
  flDelay.connect(flFeedback);
  flFeedback.connect(flDelay);
  flDelay.connect(flangerWet);
  flangerWet.connect(modOut);
  modOut.connect(out);

  // Delay send, with damped feedback
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0;
  const delay = ctx.createDelay(1.2);
  const fbFilter = ctx.createBiquadFilter();
  fbFilter.type = 'lowpass';
  fbFilter.frequency.value = 3500;
  const feedback = ctx.createGain();
  modOut.connect(delaySend);
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
  modOut.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(out);

  const ramp = (param, v) => param.setTargetAtTime(v, ctx.currentTime, 0.03);
  const mix = (dry, wet, v) => { ramp(dry.gain, 1 - v); ramp(wet.gain, v); };

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
    lowpass: (v) => ramp(lowpass.frequency, lowpassHz(v)),
    comp: (v) => {
      ramp(comp.threshold, -v * 40);
      ramp(comp.ratio, 1 + v * 11);
      ramp(compMakeup.gain, 1 + v * 1.4);
    },
    tremolo: (v) => {
      ramp(tremDepth.gain, v * 0.45);
      ramp(trem.gain, 1 - v * 0.45);
    },
    ring: (v) => mix(ringDry, ringWet, v),
    pan: (v) => ramp(panDepth.gain, v * 0.9),
    phaser: (v) => ramp(phaserWet.gain, v),
    chorus: (v) => ramp(chorusWet.gain, v * 0.7),
    flanger: (v) => ramp(flangerWet.gain, v * 0.8),
    rate: (v) => {
      const k = modRateScale(v);
      Object.entries(lfos).forEach(([name, o]) => ramp(o.frequency, BASE_HZ[name] * k));
    },
    delay: (v) => ramp(delaySend.gain, v * 0.65),
    delayTime: (v) => ramp(delay.delayTime, delaySeconds(v)),
    feedback: (v) => ramp(feedback.gain, v * 0.85),
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
