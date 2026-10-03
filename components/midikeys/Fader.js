import React, { useRef } from 'react';

/**
 * A vertical fader for the /midi-keyboard mixer, 0..1 bottom to top. Drag the
 * cap or click the track to jump there (Shift for fine), arrow keys step it,
 * double-click resets it to its default.
 */
export default function Fader({ label, sub, value, def, display, onChange, learning, onLearn, dim }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const clamp = (v) => Math.min(Math.max(v, 0), 1);

  const posFromY = (clientY) => {
    const r = trackRef.current.getBoundingClientRect();
    return clamp(1 - (clientY - r.top) / r.height);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    const onCap = e.target.classList && e.target.classList.contains('mk-fader__cap');
    drag.current = { y: e.clientY, v: onCap ? value : posFromY(e.clientY) };
    if (!onCap) onChange(drag.current.v);
  };
  const onPointerMove = (e) => {
    if (!drag.current || !trackRef.current) return;
    const h = trackRef.current.getBoundingClientRect().height || 1;
    const scale = e.shiftKey ? 0.25 : 1;
    onChange(clamp(drag.current.v + ((drag.current.y - e.clientY) / h) * scale));
  };
  const onPointerUp = () => { drag.current = null; };
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(clamp(value + step)); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(clamp(value - step)); }
  };

  return (
    <div className={`mk-fader ${learning ? 'is-learning' : ''} ${dim ? 'is-dim' : ''}`}>
      <span className="mk-fader__value">{learning ? 'Move…' : display}</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={display}
        className="mk-fader__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(def)}
        onKeyDown={onKeyDown}
      >
        <div className="mk-fader__fill" style={{ height: `${value * 100}%` }} />
        <div className="mk-fader__cap" style={{ bottom: `calc(${value * 100}% - 7px)` }} />
      </div>
      <span className="mk-fader__label">{label}</span>
      <span className="mk-fader__sub" title={sub || ''}>{sub || ' '}</span>
      <button type="button" className="mk-knob__learn" onClick={onLearn}>{learning ? 'Cancel' : 'Learn'}</button>
    </div>
  );
}
