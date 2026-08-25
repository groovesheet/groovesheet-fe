const PERCUSSION_BY_NOTATION = {
  'F4:normal': [36, 'Bass Drum 1'],
  'C5:normal': [38, 'Acoustic Snare'],
  'C5:x': [37, 'Side Stick'],
  'G5:x': [42, 'Closed Hi-Hat'],
  'G5:circle-x': [46, 'Open Hi-Hat'],
  'A5:x': [49, 'Crash Cymbal 1'],
  'F5:x': [51, 'Ride Cymbal 1'],
  'E5:normal': [50, 'High Tom'],
  'D5:normal': [47, 'Low-Mid Tom'],
  'A4:normal': [43, 'High Floor Tom'],
};

function addPercussionPlaybackMetadata(doc) {
  const root = doc.documentElement;
  root.querySelectorAll('part-list > score-part').forEach((scorePart) => {
    const label = scorePart.querySelector(':scope > part-name')?.textContent?.trim().toLowerCase() || '';
    if (!label.includes('percussion') && !label.includes('drum')) return;
    const partId = scorePart.getAttribute('id');
    const part = Array.from(root.querySelectorAll(':scope > part'))
      .find((node) => node.getAttribute('id') === partId);
    if (!part) return;

    const used = new Map();
    part.querySelectorAll('note').forEach((note) => {
      if (note.querySelector(':scope > instrument')) return;
      const unpitched = note.querySelector(':scope > unpitched');
      if (!unpitched) return;
      const step = unpitched.querySelector(':scope > display-step')?.textContent?.trim();
      const octave = unpitched.querySelector(':scope > display-octave')?.textContent?.trim();
      const head = note.querySelector(':scope > notehead')?.textContent?.trim() || 'normal';
      const definition = PERCUSSION_BY_NOTATION[`${step}${octave}:${head}`]
        || PERCUSSION_BY_NOTATION[`${step}${octave}:normal`];
      if (!definition) return;
      const [midiKey, name] = definition;
      const instrumentId = `${partId}-GS-I${midiKey + 1}`;
      used.set(instrumentId, { midiKey, name });
      const instrument = doc.createElement('instrument');
      instrument.setAttribute('id', instrumentId);
      const before = note.querySelector(':scope > voice, :scope > type, :scope > dot, :scope > accidental, :scope > time-modification, :scope > stem, :scope > notehead, :scope > staff, :scope > beam, :scope > notations, :scope > lyric');
      if (before) note.insertBefore(instrument, before); else note.appendChild(instrument);
    });

    if (!used.size) return;
    let midiDevice = scorePart.querySelector(':scope > midi-device');
    if (!midiDevice) {
      midiDevice = doc.createElement('midi-device');
      midiDevice.setAttribute('port', '1');
      const firstMidi = scorePart.querySelector(':scope > midi-instrument');
      if (firstMidi) scorePart.insertBefore(midiDevice, firstMidi); else scorePart.appendChild(midiDevice);
    }
    used.forEach(({ midiKey, name }, instrumentId) => {
      if (!scorePart.querySelector(`:scope > score-instrument[id="${instrumentId}"]`)) {
        const scoreInstrument = doc.createElement('score-instrument');
        scoreInstrument.setAttribute('id', instrumentId);
        const instrumentName = doc.createElement('instrument-name');
        instrumentName.textContent = name;
        scoreInstrument.appendChild(instrumentName);
        scorePart.insertBefore(scoreInstrument, midiDevice);
      }
      if (!scorePart.querySelector(`:scope > midi-instrument[id="${instrumentId}"]`)) {
        const midiInstrument = doc.createElement('midi-instrument');
        midiInstrument.setAttribute('id', instrumentId);
        [['midi-channel', '10'], ['midi-program', '1'], ['midi-unpitched', String(midiKey + 1)]]
          .forEach(([tag, value]) => {
            const child = doc.createElement(tag);
            child.textContent = value;
            midiInstrument.appendChild(child);
          });
        scorePart.appendChild(midiInstrument);
      }
    });
  });
}

/** Replace worker placeholder metadata and repair legacy percussion playback. */
export function applyMusicXmlMetadata(xmlString, { title, artist, sourceCredit } = {}) {
  if (!xmlString || typeof DOMParser === 'undefined') return xmlString;
  try {
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    if (doc.querySelector('parsererror')) return xmlString;
    const root = doc.documentElement;

    const ensureChild = (parent, name, beforeSelector) => {
      let node = parent.querySelector(`:scope > ${name}`);
      if (!node) {
        node = doc.createElement(name);
        const before = beforeSelector ? parent.querySelector(`:scope > ${beforeSelector}`) : null;
        if (before) parent.insertBefore(node, before);
        else parent.appendChild(node);
      }
      return node;
    };

    if (title && title.trim()) {
      const work = ensureChild(root, 'work', 'movement-title, identification, defaults, part-list');
      ensureChild(work, 'work-title').textContent = title.trim();
      ensureChild(root, 'movement-title', 'identification, defaults, part-list').textContent = title.trim();
    }
    const upsertCreator = (type, value) => {
      if (!value || !value.trim()) return;
      const identification = ensureChild(root, 'identification', 'defaults, part-list');
      let creator = Array.from(identification.querySelectorAll(':scope > creator'))
        .find((node) => node.getAttribute('type') === type);
      if (!creator) {
        creator = doc.createElement('creator');
        creator.setAttribute('type', type);
        identification.insertBefore(creator, identification.firstChild);
      }
      creator.textContent = value.trim();
    };
    upsertCreator('composer', artist);
    upsertCreator('lyricist', sourceCredit);
    addPercussionPlaybackMetadata(doc);
    return new XMLSerializer().serializeToString(doc);
  } catch (_) {
    return xmlString;
  }
}

export function titleFromFilename(filename) {
  const stem = String(filename || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').trim();
  for (const separator of [' — ', ' – ', ' - ']) {
    if (stem.includes(separator)) return stem.split(separator, 2)[1].trim() || stem;
  }
  return stem || 'Untitled transcription';
}
