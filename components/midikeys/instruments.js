/**
 * The 128 General MIDI instruments for /midi-keyboard, in program order and
 * grouped in the standard families of eight.
 *
 * Samples are the open-source soundfonts rendered by gleitz/midi-js-soundfonts
 * (MIT, hosted on GitHub Pages), each in three sample sets:
 *   - MusyngKite  (CC BY-SA 3.0), the fullest, and the one the site uses
 *   - FluidR3_GM  (CC BY 3.0), lighter and drier
 *   - FatBoy      (CC BY-SA 3.0), warmer, with longer tails
 * The page credits them, as both licences require.
 */

export const SAMPLE_SETS = [
  { id: 'MusyngKite', label: 'MusyngKite', license: 'CC BY-SA 3.0' },
  { id: 'FluidR3_GM', label: 'FluidR3', license: 'CC BY 3.0' },
  { id: 'FatBoy', label: 'FatBoy', license: 'CC BY-SA 3.0' },
];

export const sampleUrl = (name, set) => {
  const sf = SAMPLE_SETS.some((s) => s.id === set) ? set : 'MusyngKite';
  return `https://gleitz.github.io/midi-js-soundfonts/${sf}/${name}-mp3.js`;
};

const FAMILIES = [
  ['Piano', ['acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano', 'honkytonk_piano', 'electric_piano_1', 'electric_piano_2', 'harpsichord', 'clavinet']],
  ['Chromatic percussion', ['celesta', 'glockenspiel', 'music_box', 'vibraphone', 'marimba', 'xylophone', 'tubular_bells', 'dulcimer']],
  ['Organ', ['drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ', 'reed_organ', 'accordion', 'harmonica', 'tango_accordion']],
  ['Guitar', ['acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_jazz', 'electric_guitar_clean', 'electric_guitar_muted', 'overdriven_guitar', 'distortion_guitar', 'guitar_harmonics']],
  ['Bass', ['acoustic_bass', 'electric_bass_finger', 'electric_bass_pick', 'fretless_bass', 'slap_bass_1', 'slap_bass_2', 'synth_bass_1', 'synth_bass_2']],
  ['Strings', ['violin', 'viola', 'cello', 'contrabass', 'tremolo_strings', 'pizzicato_strings', 'orchestral_harp', 'timpani']],
  ['Ensemble', ['string_ensemble_1', 'string_ensemble_2', 'synth_strings_1', 'synth_strings_2', 'choir_aahs', 'voice_oohs', 'synth_choir', 'orchestra_hit']],
  ['Brass', ['trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn', 'brass_section', 'synth_brass_1', 'synth_brass_2']],
  ['Reed', ['soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax', 'oboe', 'english_horn', 'bassoon', 'clarinet']],
  ['Pipe', ['piccolo', 'flute', 'recorder', 'pan_flute', 'blown_bottle', 'shakuhachi', 'whistle', 'ocarina']],
  ['Synth lead', ['lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff', 'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead']],
  ['Synth pad', ['pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir', 'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep']],
  ['Synth effects', ['fx_1_rain', 'fx_2_soundtrack', 'fx_3_crystal', 'fx_4_atmosphere', 'fx_5_brightness', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi']],
  ['Ethnic', ['sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle', 'shanai']],
  ['Percussive', ['tinkle_bell', 'agogo', 'steel_drums', 'woodblock', 'taiko_drum', 'melodic_tom', 'synth_drum', 'reverse_cymbal']],
  ['Sound effects', ['guitar_fret_noise', 'breath_noise', 'seashore', 'bird_tweet', 'telephone_ring', 'helicopter', 'applause', 'gunshot']],
];

// Readable names where the sample id is cryptic.
const LABELS = {
  honkytonk_piano: 'Honky-tonk piano',
  electric_piano_1: 'Electric piano (Rhodes)',
  electric_piano_2: 'Electric piano (FM)',
  fx_1_rain: 'FX: rain',
  fx_2_soundtrack: 'FX: soundtrack',
  fx_3_crystal: 'FX: crystal',
  fx_4_atmosphere: 'FX: atmosphere',
  fx_5_brightness: 'FX: brightness',
  fx_6_goblins: 'FX: goblins',
  fx_7_echoes: 'FX: echoes',
  fx_8_scifi: 'FX: sci-fi',
  lead_8_bass__lead: 'Lead 8: bass + lead',
};

const humanise = (id) => {
  if (LABELS[id]) return LABELS[id];
  const s = id
    .replace(/^(lead|pad)_(\d)_(.*)$/, (m, kind, n, rest) => `${kind} ${n}: ${rest}`)
    .replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** [{ family, instruments: [{ id, label, program }] }], program 0..127 */
export const GM_FAMILIES = FAMILIES.map(([family, ids], f) => ({
  family,
  instruments: ids.map((id, i) => ({ id, label: humanise(id), program: f * 8 + i })),
}));

export const GM_INSTRUMENTS = GM_FAMILIES.flatMap((f) => f.instruments);

/** The instrument for a MIDI Program Change number, or null. */
export const instrumentForProgram = (program) => GM_INSTRUMENTS[program] || null;
