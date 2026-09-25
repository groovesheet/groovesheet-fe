import type { CSSProperties } from 'react';
import './SkeletonPanel.css';

export interface SkeletonPanelProps {
  /** Number of stacked panels to render. */
  count?: number;
  /** Panel height; a number is pixels. */
  height?: number | string;
  /** Extra inline styles for each panel. */
  style?: CSSProperties;
  /** Extra class on the wrapping group. */
  className?: string;
  /** Render the panels without a wrapper, as children of the caller's grid or flex. */
  bare?: boolean;
}

/**
 * Breathing, rounded gray loading placeholder, shared so every page shows the
 * same pulsing panel while data loads instead of plain text.
 */
export function SkeletonPanel({
  count = 1,
  height = 96,
  style,
  className = '',
  bare = false,
}: SkeletonPanelProps) {
  const h = typeof height === 'number' ? `${height}px` : height;
  const panels = Array.from({ length: count }).map((_, i) => (
    <div key={i} className="skeleton-panel" style={{ height: h, ...style }} aria-hidden="true" />
  ));
  // The wrapper is a flex column; inside a CSS grid it collapsed six
  // placeholder cards into one tall stack in the first cell, hence `bare`.
  if (bare) return <>{panels}</>;
  return (
    <div className={`skeleton-panel-group ${className}`.trim()} aria-busy="true" aria-live="polite">
      {panels}
    </div>
  );
}

export default SkeletonPanel;
