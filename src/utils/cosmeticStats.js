/**
 * Deterministic, cosmetic engagement stats derived from a track id.
 *
 * The public library API does not expose views/likes/ratings/difficulty yet.
 * The explore + song designs lean on those numbers for visual rhythm, so we
 * synthesize stable placeholder values seeded by the track id (same approach
 * the original design mocks used). Replace with real fields when the backend
 * grows engagement metrics — every consumer imports from here.
 */

function hash(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export function seededDifficulty(id) {
  return DIFFICULTIES[hash(id) % 3];
}

/** Pseudo view count in the 1.2k–58k range; boosted by real popularity when present. */
export function seededViews(id, popularity = 0) {
  const base = 1200 + (hash(id) % 17) * 1900;
  return base + (popularity || 0) * 420;
}

/** Pseudo likes — roughly 6–10% of views. */
export function seededLikes(id, popularity = 0) {
  return Math.round(seededViews(id, popularity) * (0.06 + (hash(id) % 5) * 0.01));
}

export function seededComments(id) {
  return 4 + (hash(id) % 90);
}

/** Star rating between 4.3 and 4.9. */
export function seededRating(id) {
  return 4.3 + (hash(id) % 7) * 0.1;
}

export function seededRatingCount(id) {
  return 40 + (hash(id) % 900);
}
