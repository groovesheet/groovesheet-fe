import React from 'react';
import './SkeletonPanel.css';

/**
 * Breathing, rounded gray loading placeholder.
 *
 * Shared between TranscriptionHistory and AccountBilling so every page
 * shows the same pulsing panel while data loads instead of plain text.
 *
 * @param {number}  [count=1]   Number of stacked panels to render.
 * @param {number|string} [height=96] Panel height (number -> px).
 * @param {object}  [style]     Extra inline styles for each panel.
 * @param {string}  [className] Extra class on the wrapping group.
 */
export const SkeletonPanel = ({ count = 1, height = 96, style, className = '' }) => {
  const h = typeof height === 'number' ? `${height}px` : height;
  return (
    <div className={`skeleton-panel-group ${className}`.trim()} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-panel" style={{ height: h, ...style }} />
      ))}
    </div>
  );
};

export default SkeletonPanel;
