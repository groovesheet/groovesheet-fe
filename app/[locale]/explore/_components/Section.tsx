'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Link } from '@/lib/navigation';
import SongCard from './SongCard';
import type { CardVariant } from './thumbs/resolveThumb';
import type { SongCardModel } from './trackToCard';
import './Section.css';

interface SectionProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  songs: SongCardModel[];
  variant?: CardVariant | null;
  accent?: boolean;
  /** The results page this rail expands into. A link, so crawlers reach it too. */
  viewAllHref?: string;
}

/** A horizontally scrolling rail of SongCards. Renders nothing when empty. */
function Section({ eyebrow, title, subtitle, songs, variant, accent, viewAllHref }: SectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const updateBtns = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // ResizeObserver reports once on observe, which covers the initial state
    // and every later change of the row's width or its card count.
    const observer = new ResizeObserver(updateBtns);
    observer.observe(el);
    el.addEventListener('scroll', updateBtns, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateBtns);
    };
  }, [updateBtns, songs]);

  const scrollBy = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth - 80), behavior: 'smooth' });
  };

  if (!songs || songs.length === 0) return null;

  return (
    <section className="explore-section">
      <header className="es-header">
        <div className="es-titles">
          {eyebrow && <div className={`es-eyebrow${accent ? ' es-eyebrow-accent' : ''}`}>{eyebrow}</div>}
          <h2 className="es-title">{title}</h2>
          {subtitle && <p className="es-subtitle">{subtitle}</p>}
        </div>
        <div className="es-controls">
          {viewAllHref && (
            <Link href={viewAllHref} className="es-view-all">
              View all
            </Link>
          )}
          <button className="es-arrow-btn" disabled={!canL} onClick={() => scrollBy(-1)} aria-label="Scroll left">
            <CaretLeft size={16} weight="bold" />
          </button>
          <button className="es-arrow-btn" disabled={!canR} onClick={() => scrollBy(1)} aria-label="Scroll right">
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </header>
      <div ref={ref} className="es-row">
        {songs.map((s, i) => (
          <SongCard key={s.id + i} song={s} variant={variant} />
        ))}
      </div>
    </section>
  );
}

export default Section;
