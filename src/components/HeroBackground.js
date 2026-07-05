import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const DARK_IMAGES = [
  'Dark1.webp',
  'Dark2.webp',
  'Dark3.webp',
  'Dark4.webp',
  'Dark5.webp',
  'Dark6.webp',
  'Dark7.webp',
  'Dark8.webp',
];
const LIGHT_IMAGES = [
  'Light1.webp',
  'Light2.webp',
  'Light3.webp',
  'Light4.webp',
  'Light5.webp',
  'Light6.webp',
  'Light7.webp',
];

const getRandomHeroBackground = (isDarkMode) => {
  const pool = isDarkMode ? DARK_IMAGES : LIGHT_IMAGES;
  const randomImage = pool[Math.floor(Math.random() * pool.length)];
  return `${process.env.PUBLIC_URL}/images/hero-section/${randomImage}`;
};

const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

// Random theme-matched hero background. The image is fully downloaded and
// decoded before it is painted, so it appears in one shot instead of
// rendering progressively as bytes arrive.
function HeroBackground() {
  const { isDarkMode } = useTheme();
  const [background, setBackground] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const nextBackgroundUrl = getRandomHeroBackground(isDarkMode);

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      preloadImage(nextBackgroundUrl)
        .then(() => {
          if (!cancelled) setBackground(nextBackgroundUrl);
        })
        .catch((err) => {
          console.error('Failed to preload hero background:', err);
        });
      return () => {
        cancelled = true;
      };
    }

    // Theme toggle: fade out (0.8s), swap while invisible, fade back in.
    setIsFadingOut(true);

    // Start preloading at ~200ms into the fade
    const preloadTimeout = setTimeout(() => {
      preloadImage(nextBackgroundUrl).catch((err) => {
        console.error('Failed to preload hero background:', err);
      });
    }, 200);

    const swapTimeout = setTimeout(() => {
      setBackground(nextBackgroundUrl);
      setIsFadingOut(false);
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(preloadTimeout);
      clearTimeout(swapTimeout);
    };
  }, [isDarkMode]);

  return (
    <div
      className={`hero-background ${isFadingOut ? 'fade-out' : ''}`}
      style={background ? { backgroundImage: `url(${background})` } : undefined}
    ></div>
  );
}

export default HeroBackground;
