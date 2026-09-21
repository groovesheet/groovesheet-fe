/* eslint-disable @next/next/no-img-element -- a small static SVG from public/; next/image adds nothing */
import './VariantHoverWrapper.css';

export interface VariantHoverWrapperProps {
  className?: string;
  componentVector?: string;
  /** Accepted for the design snippet's call shape; the placeholder has no hover state. */
  hover?: boolean;
  variant?: string;
}

// Simple placeholder for the hoverable wrapper used in the design snippet.
export function VariantHoverWrapper({
  className = '',
  componentVector = '/images/vector-2.svg',
  variant = 'default',
}: VariantHoverWrapperProps) {
  return (
    <div className={`variant-hover-wrapper ${className}`.trim()} aria-label={`variant-${variant}`}>
      <img src={componentVector} alt="vector" className="variant-hover-wrapper__img" />
    </div>
  );
}

export default VariantHoverWrapper;
