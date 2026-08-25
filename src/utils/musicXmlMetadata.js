/** Replace worker placeholder metadata with the track's real title and credit. */
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
