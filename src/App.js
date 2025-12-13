import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/layout/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Testimonials from './components/Testimonials';
import ComparePlans from './components/ComparePlans';
import FAQ from './components/FAQ';
import Footer from './components/layout/Footer';
import { LoginModal } from './components/LoginModal';
import TranscriptionHistory from './components/TranscriptionHistory';
import SSOCallback from './components/SSOCallback';
import Blog from './components/Blog';
import About from './components/About';
import Element from './components/Element';
import { ThemeProvider, useTheme } from './context/ThemeContext';

// Function to preload an image and return a promise
const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

// Function to get a random hero background image based on theme
const getRandomHeroBackground = (isDarkMode) => {
  const darkImages = ['Dark1.png', 'Dark2.png', 'Dark3.png', 'Dark4.png', 'Dark5.png', 'Dark6.png', 'Dark7.png', 'Dark8.png'];
  const lightImages = ['Light1.png', 'Light2.png', 'Light3.png', 'Light4.png', 'Light5.png', 'Light6.png', 'Light7.png'];
  const pool = isDarkMode ? darkImages : lightImages;
  const randomImage = pool[Math.floor(Math.random() * pool.length)];
  return `${process.env.PUBLIC_URL}/images/hero-section/${randomImage}`;
};

function LandingPage({ onLoginClick }) {
  const { isDarkMode } = useTheme();
  const [heroBackground, setHeroBackground] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isGradientHidden, setIsGradientHidden] = useState(false);
  const backgroundRef = useRef(null);
  const gradientRef = useRef(null);

  // Set initial background on mount
  useEffect(() => {
    setHeroBackground(getRandomHeroBackground(isDarkMode));
  }, []);

  // Smooth transition: fade out completely, swap image while invisible, fade in
  useEffect(() => {
    if (!backgroundRef.current) return;

    const newBackgroundUrl = getRandomHeroBackground(isDarkMode);

    // Instantly hide gradient to prevent darkening during transition
    setIsGradientHidden(true);

    // Fade out current image (1.2s)
    setIsFadingOut(true);

    // Start preloading at 300ms into the fade
    const preloadTimeout = setTimeout(() => {
      preloadImage(newBackgroundUrl).catch((err) => {
        console.error('Failed to preload hero background:', err);
      });
    }, 300);

    // After fade out completes (1.2s), swap image and fade in
    const swapTimeout = setTimeout(() => {
      setHeroBackground(newBackgroundUrl);
      // Remove fade-out class to trigger fade in (1.2s)
      setIsFadingOut(false);
    }, 1200);

    // After swap, fade gradient back in (1.2s)
    const gradientTimeout = setTimeout(() => {
      setIsGradientHidden(false);
    }, 1200);

    return () => {
      clearTimeout(preloadTimeout);
      clearTimeout(swapTimeout);
      clearTimeout(gradientTimeout);
    };
  }, [isDarkMode]);

  return (
    <div className="app-container">
      <div className="dot-grid"></div>
      <div
        ref={backgroundRef}
        className={`hero-background ${isFadingOut ? 'fade-out' : ''}`}
        style={{ backgroundImage: `url(${heroBackground})` }}
      ></div>
      <Header onLoginClick={onLoginClick} />
      <Hero onLoginRequired={onLoginClick} />
      <div
        ref={gradientRef}
        className={`features-gradient ${isGradientHidden ? 'hidden' : ''}`}
      />
      <Features />
      <Pricing />
      {/* High-Accuracy Drum Scores section */}
      <Element />
      <Testimonials />
      <ComparePlans />
      <FAQ />
      <Footer />
    </div>
  );
}

function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    document.body.classList.add('modal-open');
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    document.body.classList.remove('modal-open');
  };

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage onLoginClick={openLoginModal} />} />
          <Route path="/history" element={<TranscriptionHistory />} />
          <Route path="/blog" element={<Blog onLoginClick={openLoginModal} />} />
          <Route path="/about" element={<About onLoginClick={openLoginModal} />} />
          <Route path="/sso-callback" element={<SSOCallback />} />
        </Routes>
        <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      </Router>
    </ThemeProvider>
  );
}

export default App;
