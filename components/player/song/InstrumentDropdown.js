// Instrument switcher for the song viewer toolbar (and shared with the
// sidebar select). Custom button + popover instead of a native <select> so
// each option shows its stem color swatch. Value/state live in SongDetail —
// this is a fully controlled component.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import './InstrumentDropdown.css';

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MENU_MIN_WIDTH = 180;

/**
 * Where the menu goes, in viewport coordinates: under the button, right edges
 * aligned, kept inside the viewport.
 *
 * The menu is portalled to <body> and positioned `fixed` because on phones the
 * viewer toolbar is a horizontal scroller (overflow-x: auto, which forces
 * overflow-y to clip too). Positioned inside it, the menu opened below the
 * strip's bottom edge and was clipped away entirely, so tapping the picker
 * looked like it did nothing.
 */
function menuPosition(button) {
  const r = button.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = r.bottom + MENU_GAP;
  const maxRight = Math.max(VIEWPORT_MARGIN, vw - MENU_MIN_WIDTH - VIEWPORT_MARGIN);
  const right = Math.min(Math.max(vw - r.right, VIEWPORT_MARGIN), maxRight);
  return { top, right, maxHeight: Math.max(120, vh - top - VIEWPORT_MARGIN) };
}

/**
 * options: [{ name, label, color, hasNotes, hasScore }]
 * value:   selected stem `name`
 */
function InstrumentDropdown({ options, value, onChange }) {
  const t = useTranslations('song');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Measure before paint so the menu never flashes at a stale spot.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    setPos(menuPosition(btnRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const inside = (target) =>
      (ref.current && ref.current.contains(target)) || (menuRef.current && menuRef.current.contains(target));
    const onDoc = (e) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Follow the button when the page or the toolbar strip scrolls, or the
    // viewport changes (rotation, mobile URL bar).
    let raf = 0;
    const follow = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (btnRef.current) setPos(menuPosition(btnRef.current));
      });
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open]);

  if (!options || !options.length) return null;
  const cur = options.find((o) => o.name === value) || options[0];
  // Legacy tracks may carry one un-attributed score shared by every option —
  // flagging "audio only" is only meaningful once parts are per-instrument.
  const anyAttributed = options.some((o) => o.hasNotes || o.hasScore);

  const menu =
    open && pos ? (
      <div
        ref={menuRef}
        className="gs-instr-menu"
        role="listbox"
        aria-label={t('sidebar.instrument')}
        style={{ position: 'fixed', top: pos.top, right: pos.right, maxHeight: pos.maxHeight, overflowY: 'auto' }}
      >
        {options.map((o) => {
          const on = o.name === cur.name;
          const audioOnly = anyAttributed && !o.hasNotes && !o.hasScore;
          return (
            <button
              key={o.name}
              type="button"
              role="option"
              aria-selected={on}
              className={`gs-instr-item ${on ? 'on' : ''}`}
              onClick={() => {
                onChange(o.name);
                setOpen(false);
              }}
            >
              <span className="gs-instr-dot" style={{ background: o.color }} />
              <span className="gs-instr-item-label">{o.label}</span>
              {audioOnly && <span className="gs-instr-item-note">{t('viewers.audioOnly')}</span>}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="gs-instr" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className="gs-instr-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('sidebar.instrument')}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="gs-instr-dot" style={{ background: cur.color }} />
        <span>{cur.label}</span>
        <CaretDown size={11} weight="bold" style={{ opacity: 0.6 }} />
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}

export default InstrumentDropdown;
