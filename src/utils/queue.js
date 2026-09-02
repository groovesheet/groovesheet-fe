// Shared vocabulary for "your job is waiting behind other people's jobs".
//
// The backend attaches a `queue` block to a workflow while it is published but
// not yet claimed by a worker. Separations run 20-30 minutes each and the pool
// is small, so this wait is routinely longer than the work itself — presenting
// it as a queue (with a position and a rough ETA) is the difference between
// "this is broken" and "this is normal, come back later".

/** The job is in line behind other jobs — not yet being worked on. */
export const isQueued = (w) => w?.queue?.state === 'queued' && w.queue.position > 0;

/** "Next in line" / "3rd in line" / "50+ in line" */
export function queuePositionLabel(queue) {
  if (!queue || queue.position == null || queue.position <= 0) return null;
  const n = queue.position;
  if (queue.capped) return `${n}+ in line`;
  if (n === 1) return 'Next in line';
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st'
    : n % 10 === 2 && n % 100 !== 12 ? 'nd'
    : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix} in line`;
}

/**
 * Round an ETA up to a human bucket. These are ceilings on a queue that moves
 * in ~25-minute steps, so a precise-looking "43 min" would imply an accuracy
 * we do not have — "about 45 minutes" is honest and still actionable.
 */
export function etaLabel(seconds) {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.ceil(seconds / 60);
  if (mins < 10) return 'a few minutes';
  if (mins < 90) return `about ${Math.ceil(mins / 15) * 15} minutes`;
  const hours = mins / 60;
  if (hours < 10) {
    const half = Math.ceil(hours * 2) / 2;
    return `about ${half % 1 === 0 ? half : Math.floor(half) + '½'} hours`;
  }
  return 'several hours';
}

/** One line combining both, e.g. "3rd in line · about 45 minutes". */
export function queueSummary(queue) {
  const pos = queuePositionLabel(queue);
  // etaLabel already carries its own hedge ("about 45 minutes", "a few
  // minutes"), so never prefix it again.
  const eta = etaLabel(queue?.eta_seconds);
  if (pos && eta) return `${pos} · ${eta}`;
  return pos || eta || null;
}
