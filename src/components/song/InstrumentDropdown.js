// Instrument switcher for the song viewer toolbar (and shared with the
// sidebar select). Custom button + popover instead of a native <select> so
// each option shows its stem color swatch. Value/state live in SongDetail —
// this is a fully controlled component.
import React, { useEffect, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import './InstrumentDropdown.css';

/**
 * options: [{ name, label, color, hasNotes, hasScore }]
 * value:   selected stem `name`
 */
function InstrumentDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!options || !options.length) return null;
  const cur = options.find((o) => o.name === value) || options[0];
  // Legacy tracks may carry one un-attributed score shared by every option —
  // flagging "audio only" is only meaningful once parts are per-instrument.
  const anyAttributed = options.some((o) => o.hasNotes || o.hasScore);

  return (
    <div className="gs-instr" ref={ref}>
      <button
        type="button"
        className="gs-instr-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Instrument"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="gs-instr-dot" style={{ background: cur.color }} />
        <span>{cur.label}</span>
        <CaretDown size={11} weight="bold" style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div className="gs-instr-menu" role="listbox" aria-label="Instrument">
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
                {audioOnly && <span className="gs-instr-item-note">audio only</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InstrumentDropdown;
