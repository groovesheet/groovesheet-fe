// The "there is more song than this" panel that sits directly under the
// engraved 10-second preview.
//
// A preview only ever produces 10 seconds of output, so there is no real
// remainder to render — the staves below the fold are decorative. They exist
// to show the *shape* of a full page (systems continuing past the preview)
// behind a blur, with the upgrade CTA on top. Purely presentational:
// aria-hidden, pointer-events none, and no claim about the missing bars.
import React, { useMemo } from 'react';
import { LockSimple } from '@phosphor-icons/react';

// Deterministic pseudo-random so the ghost staves don't reshuffle on every
// re-render (which would flicker under the blur).
const rand = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const SYSTEM_W = 820;
const SYSTEM_H = 96;
const STAFF_TOP = 26;
const STAFF_GAP = 9; // px between the five staff lines

/** One five-line system with note-shaped marks scattered on it. */
function GhostSystem({ index }) {
  const marks = useMemo(() => {
    const out = [];
    const count = 13 + Math.floor(rand(index * 7 + 1) * 5);
    for (let i = 0; i < count; i += 1) {
      const seed = index * 100 + i;
      const x = 60 + (i / count) * (SYSTEM_W - 100) + rand(seed) * 14;
      const step = Math.floor(rand(seed + 0.5) * 9); // which line/space
      const y = STAFF_TOP + (step * STAFF_GAP) / 2;
      const stemUp = rand(seed + 0.25) > 0.45;
      const beamed = rand(seed + 0.75) > 0.55;
      out.push({ x, y, stemUp, beamed, key: `${index}-${i}` });
    }
    return out;
  }, [index]);

  return (
    <svg
      className="tr-lock-system"
      viewBox={`0 0 ${SYSTEM_W} ${SYSTEM_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
    >
      {[0, 1, 2, 3, 4].map((line) => (
        <line
          key={line}
          x1="24"
          x2={SYSTEM_W - 24}
          y1={STAFF_TOP + line * STAFF_GAP}
          y2={STAFF_TOP + line * STAFF_GAP}
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.75"
        />
      ))}
      {/* Barlines */}
      {[0.28, 0.53, 0.79].map((f) => (
        <line
          key={f}
          x1={24 + f * (SYSTEM_W - 48)}
          x2={24 + f * (SYSTEM_W - 48)}
          y1={STAFF_TOP}
          y2={STAFF_TOP + 4 * STAFF_GAP}
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.6"
        />
      ))}
      {marks.map((m) => (
        <g key={m.key} fill="currentColor" stroke="currentColor" opacity="0.82">
          <ellipse cx={m.x} cy={m.y} rx="5.2" ry="3.9" strokeWidth="0" transform={`rotate(-18 ${m.x} ${m.y})`} />
          <line
            x1={m.stemUp ? m.x + 5 : m.x - 5}
            x2={m.stemUp ? m.x + 5 : m.x - 5}
            y1={m.y}
            y2={m.stemUp ? m.y - 24 : m.y + 24}
            strokeWidth="1.6"
          />
          {m.beamed && (
            <line
              x1={m.stemUp ? m.x + 5 : m.x - 5}
              x2={m.stemUp ? m.x + 22 : m.x + 12}
              y1={m.stemUp ? m.y - 24 : m.y + 24}
              y2={m.stemUp ? m.y - 21 : m.y + 21}
              strokeWidth="3.4"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

export default function PreviewLockTeaser({
  isSignedIn,
  onUpgradeToFull,
  onSignUpToUnlock,
  upgrading,
  systems = 4,
}) {
  const canUpgrade = Boolean(isSignedIn ? onUpgradeToFull : onSignUpToUnlock);

  return (
    <div className="tr-lock">
      {/* Paper carries the background; only the ink layer is blurred, so the
          join with the engraved page above stays a clean edge. */}
      <div className="tr-lock-page" aria-hidden="true">
        <div className="tr-lock-ghost">
          {Array.from({ length: systems }, (_, i) => (
            <GhostSystem key={i} index={i} />
          ))}
        </div>
      </div>

      <div className="tr-lock-panel">
        <div className="tr-lock-icon">
          <LockSimple size={20} weight="fill" />
        </div>
        <div className="tr-lock-copy">
          <h3>The rest of this song is locked</h3>
          <p>
            You&apos;re looking at a 10-second preview. Unlock the full transcription to get every
            bar — plus the complete MIDI, MusicXML and printable PDF.
          </p>
        </div>
        {canUpgrade && (
          isSignedIn ? (
            <button
              type="button"
              className="tr-btn tr-btn-primary tr-lock-cta"
              onClick={onUpgradeToFull}
              disabled={upgrading}
            >
              {upgrading ? 'Starting…' : 'Transcribe the full song now'}
            </button>
          ) : (
            <button
              type="button"
              className="tr-btn tr-btn-primary tr-lock-cta"
              onClick={onSignUpToUnlock}
            >
              Sign up to unlock the full song
            </button>
          )
        )}
      </div>
    </div>
  );
}
