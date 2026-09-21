import { useIsClient } from '@/components/ClientOnly';
import SheetThumb from './SheetThumb';
import MidiThumb from './MidiThumb';
import StemThumb from './StemThumb';
import type { SongCardModel } from '../trackToCard';

export interface ThumbProps {
  song: Pick<SongCardModel, 'id' | 'parts' | 'difficulty'>;
  /** thumb_data.stems: stem name to 0..100 peak values. */
  peaks?: Record<string, number[]> | null;
  width?: number;
  height?: number;
}

export type CardVariant = 'sheet' | 'midi' | 'stems';

/**
 * Pick the generated thumbnail for a track.
 *
 * Shared by SongCard (grid) and ResultRow (list) so the two views never drift
 * into showing a different thumb for the same track.
 */
export default function resolveThumb(
  song: Pick<SongCardModel, 'id' | 'thumbData'>,
  variant?: CardVariant | null
): CardVariant {
  if (variant) return variant;
  // Stems thumbs are the most honest default (we always have stem peaks when
  // thumb_data exists); otherwise pick deterministically from the id.
  if (song.thumbData && song.thumbData.stems) return 'stems';
  const flavors: CardVariant[] = ['sheet', 'midi', 'stems'];
  const id = String(song.id || '00');
  const c = (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % flavors.length;
  return flavors[c];
}

/**
 * The generated thumbnail of one kind, drawn in the browser only. A rail page
 * holds a few hundred cards and each thumbnail is a couple of hundred SVG
 * nodes: server-rendered, they were 2MB of the /explore HTML and told a
 * crawler nothing. The CRA app drew them client-side too.
 */
export function CardThumb({ kind, ...props }: ThumbProps & { kind: CardVariant }) {
  const isClient = useIsClient();
  if (!isClient) return <div className="card-thumb-placeholder" aria-hidden="true" />;
  if (kind === 'sheet') return <SheetThumb {...props} />;
  if (kind === 'midi') return <MidiThumb {...props} />;
  return <StemThumb {...props} />;
}
