import React, { useEffect, useRef, useState } from 'react';

/**
 * Video1 — live-editable preview of the stem video frame.
 *
 * Ported from groovesheet-social/renderers/stem_remotion Stem.tsx to plain
 * React so it can be designed/iterated at http://localhost:3001/video1.
 * The frame is authored at its native 3840x2160 (4K, 16:9) and scaled to fit
 * the viewport via a transform on the outer wrapper — edit the inner markup at
 * full design dimensions and it stays pixel-accurate to what the renderer ships.
 */

const ICONS = '/video-assets/icons';

// Bass.svg already encodes its own colors; everything else is a single-color
// glyph that needs the brightness/invert filter to show white on the badge.
const SELF_COLORED_ICONS = new Set(['Bass.svg']);

const DEFAULT_BOTTOM_TEXT =
  'All rights to the original song belong to its respective artists and labels. Stems and transcription by GrooveSheet for educational use only.';

// ---- Frame data (edit me) -------------------------------------------------
const frame = {
  title: 'Synthetic Demo Loop',
  artist: 'GrooveSheet Demo',
  year: 2026,
  coverPath: '/images/Preview.png',
  avatarPath: '/images/Logo_Dark.png',
  badges: [
    { label: 'Drums Track', icon: 'Drums.svg' },
    { label: 'Bass Track', icon: 'Bass.svg' },
  ],
  bottomText: DEFAULT_BOTTOM_TEXT,
  logoIcon: 'groovesheet-logo.svg',
};
// ---------------------------------------------------------------------------

const Badge = ({ label, iconFile }) => (
  <div
    style={{
      backgroundColor: '#323033',
      height: 373,
      borderRadius: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '146.187px 137.158px',
      boxSizing: 'border-box',
      width: '100%',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
      <div
        style={{
          width: 138.75,
          height: 138.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={`${ICONS}/${iconFile}`}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: SELF_COLORED_ICONS.has(iconFile) ? undefined : 'brightness(0) invert(1)',
          }}
        />
      </div>
      <div style={{ fontSize: 123.335, lineHeight: '177.423px', color: '#fff', whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </div>
  </div>
);

const Frame = () => (
  <div
    style={{
      width: 3840,
      height: 2160,
      backgroundColor: '#171717',
      fontFamily: 'Hubot Sans, Inter, system-ui, sans-serif',
    }}
  >
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 100,
        padding: 120,
        boxSizing: 'border-box',
      }}
    >
      {/* Album cover */}
      <div
        style={{
          aspectRatio: '1 / 1',
          height: '100%',
          borderRadius: 28,
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#222',
        }}
      >
        {frame.coverPath ? (
          <img src={frame.coverPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
      </div>

      {/* Right column */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}
      >
        {/* Title + artist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
          <div style={{ fontSize: 174.742, lineHeight: '209.801px', color: '#fff', fontWeight: 400, width: 1549 }}>
            {frame.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 42.243 }}>
            <div
              style={{
                width: 151.447,
                height: 151.447,
                borderRadius: 9999,
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: '#333',
              }}
            >
              {frame.avatarPath ? (
                <img src={frame.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </div>
            <div style={{ fontSize: 84.486, lineHeight: '184.813px', color: '#fff', whiteSpace: 'nowrap' }}>
              {frame.artist}
            </div>
            <div style={{ fontSize: 84.486, lineHeight: '184.813px', color: '#666' }}>•</div>
            <div style={{ fontSize: 84.486, lineHeight: '184.813px', color: '#666' }}>{frame.year}</div>
          </div>
        </div>

        {/* Badges + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 68, width: '100%' }}>
          {frame.badges.map((b, i) => (
            <Badge key={i} label={b.label} iconFile={b.icon} />
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ width: 724, color: '#fff', fontSize: 25.658, lineHeight: '30.789px', whiteSpace: 'pre-line' }}>
              {frame.bottomText}
            </div>
            <img src={`${ICONS}/${frame.logoIcon}`} alt="GrooveSheet" style={{ height: 92.752, width: 'auto' }} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function Video1() {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (!el) return;
      const { clientWidth: w, clientHeight: h } = el;
      setScale(Math.min(w / 3840, h / 2160));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: 3840, height: 2160, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0 }}>
        <Frame />
      </div>
    </div>
  );
}
