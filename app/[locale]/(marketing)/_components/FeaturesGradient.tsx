'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme';

/**
 * The landing page's fade from the hero into the features band. Its timing
 * mirrors the HeroBackground fade: hidden instantly at a theme toggle, faded
 * back in once the background has swapped (0.8s).
 */
export default function FeaturesGradient() {
  const { isDarkMode } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstantHide, setIsInstantHide] = useState(false);

  useEffect(() => {
    // Instantly hide the gradient (no transition) to avoid any flash at toggle.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hide is driven by the theme change itself
    setIsInstantHide(true);
    setIsVisible(false);

    const swapTimeout = setTimeout(() => {
      setIsInstantHide(false);
      setIsVisible(true);
    }, 800);

    return () => {
      clearTimeout(swapTimeout);
    };
  }, [isDarkMode]);

  return <div className={`features-gradient ${isVisible ? 'visible' : ''} ${isInstantHide ? 'instant-hide' : ''}`} />;
}
