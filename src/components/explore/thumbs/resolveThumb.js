import SheetThumb from './SheetThumb';
import MidiThumb from './MidiThumb';
import StemThumb from './StemThumb';

const THUMB_BY_VARIANT = {
  sheet: SheetThumb,
  midi: MidiThumb,
  stems: StemThumb,
};

/**
 * Pick the generated thumbnail for a track.
 *
 * Shared by SongCard (grid) and ResultRow (list) so the two views never drift
 * into showing a different thumb for the same track.
 */
export default function resolveThumb(song, variant) {
  if (variant && THUMB_BY_VARIANT[variant]) return THUMB_BY_VARIANT[variant];
  // Stems thumbs are the most honest default (we always have stem peaks when
  // thumb_data exists); otherwise pick deterministically from the id.
  if (song.thumbData && song.thumbData.stems) return StemThumb;
  const flavors = ['sheet', 'midi', 'stems'];
  const id = String(song.id || '00');
  const c = (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % flavors.length;
  return THUMB_BY_VARIANT[flavors[c]];
}

export { THUMB_BY_VARIANT };
