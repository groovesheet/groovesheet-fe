import React, { useRef } from 'react';

/**
 * A rotary knob for the /midi-keyboard effects panel: 0..1, a 270-degree
 * sweep like a hardware pot. Drag up/down to turn (Shift for fine), arrow keys
 * step it, double-click resets it to its default.
 */

const START = 135; // degrees, measured clockwise from 3 o'clock
const SWEEP = 270;
const R = 18;
const C = 24;

const polar = (deg) => {
  const a = (deg * Math.PI) / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
};

const arc = (from, to) => {
  const [x1, y1] = polar(from);
  const [x2, y2] = polar(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
};

export default function Knob({ label, value, def, display, onChange, learning, onLearn, centred }) {
  const drag = useRef(null);
  const clamp = (v) => Math.min(Math.max(v, 0), 1);

  const onPointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    drag.current = { y: e.clientY, v: value };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const travel = e.shiftKey ? 600 : 180; // pixels for the full sweep
    onChange(clamp(drag.current.v + (drag.current.y - e.clientY) / travel));
  };
  const onPointerUp = () => { drag.current = null; };
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(clamp(value + step)); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(clamp(value - step)); }
  };

  const angle = START + value * SWEEP;
  // EQ knobs light from the centre outwards, the rest from the minimum.
  const from = centred ? START + SWEEP / 2 : START;
  const lit = centred ? (angle >= from ? arc(from, angle) : arc(angle, from)) : arc(START, Math.max(angle, START + 0.01));
  const [px, py] = polar(angle);

  return (
    <div className={`mk-knob ${learning ? 'is-learning' : ''}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={display}
        className="mk-knob__dial"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(def)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d={arc(START, START + SWEEP)} className="mk-knob__track" />
          {Math.abs(angle - from) > 0.5 && <path d={lit} className="mk-knob__value" />}
          <circle cx={C} cy={C} r={12} className="mk-knob__cap" />
          <line x1={C} y1={C} x2={C + (px - C) * 0.62} y2={C + (py - C) * 0.62} className="mk-knob__pointer" />
        </svg>
      </div>
      <span className="mk-knob__label">{label}</span>
      <span className="mk-knob__value-text">{learning ? 'Turn a knob…' : display}</span>
      <button type="button" className="mk-knob__learn" onClick={onLearn}>{learning ? 'Cancel' : 'Learn'}</button>
    </div>
  );
}
