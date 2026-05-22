import React, { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import './FilterGroup.css';

function FilterGroup({ title, items, value, onToggle, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="filter-group">
      <button
        type="button"
        className="fg-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={`fg-caret${open ? '' : ' fg-caret-closed'}`}>
          <CaretDown size={16} weight="bold" />
        </span>
      </button>
      {open && (
        <div className="fg-list">
          {items.map((it) => {
            const checked = value.has(it.label);
            return (
              <label key={it.label} className="fg-row">
                <span className="fg-label">
                  <input
                    type="checkbox"
                    className="fg-check"
                    checked={checked}
                    onChange={() => onToggle(it.label)}
                  />
                  {it.label}
                </span>
                <span className="fg-count">{it.count.toLocaleString()}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FilterGroup;
