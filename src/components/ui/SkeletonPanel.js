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
export const SkeletonPanel = ({ count = 1, height = 96, style, className = '', bare = false }) => {
  const h = typeof height === 'number' ? `${height}px` : height;
  const panels = Array.from({ length: count }).map((_, i) => (
    <div key={i} className="skeleton-panel" style={{ height: h, ...style }} aria-hidden="true" />
  ));
  // `bare`: no wrapper, so the panels become children of the caller's own
  // grid/flex. The wrapper is a flex column — inside a CSS grid it collapsed
  // six placeholder cards into one tall stack in the first cell.
  if (bare) return <>{panels}</>;
  return (
    <div className={`skeleton-panel-group ${className}`.trim()} aria-busy="true" aria-live="polite">
      {panels}
    </div>
  );
};

export default SkeletonPanel;
