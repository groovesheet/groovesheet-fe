import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import SongCard from './SongCard';
import './Section.css';

function Section({ eyebrow, title, subtitle, songs, variant, accent, onCardClick, onViewAll }) {
  const ref = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const updateBtns = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateBtns();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', updateBtns, { passive: true });
    window.addEventListener('resize', updateBtns);
    return () => {
      el.removeEventListener('scroll', updateBtns);
      window.removeEventListener('resize', updateBtns);
    };
  }, [updateBtns, songs]);

  const scrollBy = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth - 80), behavior: 'smooth' });
  };

  if (!songs || songs.length === 0) return null;

  return (
    <section className="explore-section">
      <header className="es-header">
        <div className="es-titles">
          {eyebrow && (
            <div className={`es-eyebrow${accent ? ' es-eyebrow-accent' : ''}`}>{eyebrow}</div>
          )}
          <h2 className="es-title">{title}</h2>
          {subtitle && <p className="es-subtitle">{subtitle}</p>}
        </div>
        <div className="es-controls">
          {onViewAll && (
            <a
              href="#view-all"
              className="es-view-all"
              onClick={(e) => {
                e.preventDefault();
                onViewAll();
              }}
            >
              View all
            </a>
          )}
          <button
            className="es-arrow-btn"
            disabled={!canL}
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <button
            className="es-arrow-btn"
            disabled={!canR}
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </header>
      <div ref={ref} className="es-row">
        {songs.map((s, i) => (
          <SongCard
            key={s.id + i}
            song={s}
            variant={variant}
            onClick={(song) => onCardClick && onCardClick(song, variant)}
          />
        ))}
      </div>
    </section>
  );
}

export default Section;
