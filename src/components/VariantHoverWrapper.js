import React from 'react';

// Simple placeholder for the hoverable wrapper used in the design snippet
export const VariantHoverWrapper = ({ className = '', componentVector = '/images/vector-2.svg', hover: _hover = false, variant = 'default' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`} aria-label={`variant-${variant}`}>
      <img src={componentVector} alt="vector" className="block" />
    </div>
  );
};

export default VariantHoverWrapper;
