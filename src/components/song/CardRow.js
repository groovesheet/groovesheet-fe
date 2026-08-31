// Below-viewer horizontal rails of related-score cards.
// Ported from song-app.jsx (MiniThumbCard / SmallThumb / CardRow).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { fmtNum } from '../../mocks/songDetailData';

function SmallThumb({ song, flavor }) {
  const id = song.id;
  const [imageFailed, setImageFailed] = useState(false);
  const previewUrl = song.previewUrls?.[flavor] || (flavor === 'midi' ? song.thumbUrl : null);
  if (previewUrl && !imageFailed) {
    return (
      <img
        src={previewUrl}
        alt={`${song.title} ${flavor} preview`}
        loading="lazy"
        onError={() => setImageFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: flavor === 'sheet' ? 'contain' : 'cover',
          objectPosition: flavor === 'sheet' ? 'top center' : 'center',
          background: flavor === 'sheet' ? '#fff' : 'transparent',
          display: 'block',
        }}
      />
    );
  }
  if (flavor === 'sheet') {
    return <div style={{ width: '100%', height: '100%', background: '#fff' }} />;
  }
  if (flavor === 'midi') {
    const rand = (i) => (Math.sin(id.charCodeAt(1) + i * 1.7) + 1) / 2;
    return (
      <svg viewBox="0 0 240 130" preserveAspectRatio="none" width="100%" height="100%" style={{ background: '#0c1226' }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={i} x1={i * 8} x2={i * 8} y1={0} y2={130} stroke="#1a2148" strokeWidth="0.3" />
        ))}
        {['#7AA2FF', '#C9A0FF', '#FFC857', '#84F2A6']
          .map((c, ci) =>
            Array.from({ length: 16 }).map((_, i) => {
              const x = 8 + i * 14 + rand(ci * 7 + i) * 8;
              const y = 16 + ci * 26 + rand(ci + i) * 8;
              const w = 8 + rand(i + ci * 3) * 18;
              return <rect key={`${ci}-${i}`} x={x} y={y} width={w} height={6} rx="1.5" fill={c} fillOpacity="0.85" />;
            })
          )
          .flat()}
      </svg>
    );
  }
  // stems flavor
  const rand = (i) => (Math.sin(id.charCodeAt(0) + i * 1.3) + 1) / 2;
  return (
    <svg viewBox="0 0 240 130" preserveAspectRatio="none" width="100%" height="100%" style={{ background: '#0e0e0e' }}>
      {['#7AA2FF', '#C9A0FF', '#FFC857', '#84F2A6'].map((c, ci) => {
        const y = 14 + ci * 30;
        return (
          <g key={ci}>
            {Array.from({ length: 56 }).map((_, i) => {
              const a = rand(ci * 11 + i) * 10 + 3;
              return <rect key={i} x={4 + i * 4.2} y={y - a / 2 + 12} width={2.4} height={a} fill={c} fillOpacity="0.85" rx="0.5" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function MiniThumbCard({ song, variant = 'sheet', onClick }) {
  const seed = song.id.charCodeAt(1) + song.id.charCodeAt(0);
  const flavor = variant === 'mix' ? ['sheet', 'midi', 'stems'][seed % 3] : variant;
  const diffClass = `gs-diff ${(song.diff || 'Intermediate').toLowerCase()}`;
  const current = song.current;

  return (
    <article className="gs-card gs-card-bg" style={{ width: 240, padding: 10, position: 'relative', flexShrink: 0, cursor: 'pointer' }} onClick={() => onClick && onClick(song)}>
      {current && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 5,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
          }}
        >
          You’re here
        </div>
      )}
      <div className="gs-thumb" style={{ height: 130 }}>
        <SmallThumb song={song} flavor={flavor} />
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span className={diffClass}>{song.diff}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        <div className="gs-truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {song.title}
        </div>
        <div className="gs-truncate" style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
          {song.artist}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-muted-foreground)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Icon.Eye />
              {fmtNum(song.views)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Icon.Star style={{ color: '#f59e0b' }} />
              {song.rating.toFixed(1)}
            </span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-muted-foreground)' }}>
            <Icon.Sheet style={{ opacity: 0.7, width: 11, height: 11 }} />
            <Icon.Midi style={{ opacity: 0.7, width: 11, height: 11 }} />
            <Icon.Stems style={{ opacity: 0.7, width: 11, height: 11 }} />
          </span>
        </div>
      </div>
    </article>
  );
}

function CardRow({ title, subtitle, items, variant, onCardClick }) {
  const ref = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);
  return (
    <section className="gs-bv-section">
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, lineHeight: '26px', fontWeight: 500, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.2px' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginTop: 3 }}>{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: 'var(--color-muted-foreground)', textDecoration: 'underline', textDecorationColor: 'var(--color-border-light)', textUnderlineOffset: '3px' }}>
            View all
          </a>
          <button className="gs-arrow-btn" disabled={!canL} onClick={() => ref.current.scrollBy({ left: -(ref.current.clientWidth - 80), behavior: 'smooth' })}>
            <Icon.ChevronLeft />
          </button>
          <button className="gs-arrow-btn" disabled={!canR} onClick={() => ref.current.scrollBy({ left: ref.current.clientWidth - 80, behavior: 'smooth' })}>
            <Icon.ChevronRight />
          </button>
        </div>
      </header>
      <div ref={ref} className="gs-row-scroll" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, paddingRight: 8 }}>
        {items.map((it) => (
          <MiniThumbCard key={it.id} song={it} variant={variant} onClick={onCardClick} />
        ))}
      </div>
    </section>
  );
}

export default CardRow;
