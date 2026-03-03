import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/layout/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Testimonials from './components/Testimonials';
import FAQ from './components/FAQ';
import Footer from './components/layout/Footer';
import { LoginModal } from './components/LoginModal';
import TranscriptionHistory from './components/TranscriptionHistory';
import SSOCallback from './components/SSOCallback';
import Blog from './components/Blog';
import About from './components/About';
import StemSplitter from './components/StemSplitter';
import MidiConverter from './components/MidiConverter';
import Element from './components/Element';
import PrivacyPolicy from './components/PrivacyPolicy';
import BusinessInformation from './components/BusinessInformation';
import TermsConditions from './components/TermsConditions';
import RefundPolicy from './components/RefundPolicy';
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
  const backgroundRef = useRef(null);
  const gradientRef = useRef(null);
  const [isGradientVisible, setIsGradientVisible] = useState(false);
  const [isGradientInstantHide, setIsGradientInstantHide] = useState(false);

  // Set initial background on mount
  useEffect(() => {
    setHeroBackground(getRandomHeroBackground(isDarkMode));
    // Make gradient visible immediately on initial mount
    setIsGradientVisible(true);
  }, [isDarkMode]);

  // Smooth transition: fade out completely, swap image while invisible, fade in
  useEffect(() => {
    if (!backgroundRef.current) return;

    const newBackgroundUrl = getRandomHeroBackground(isDarkMode);

    // Instantly hide gradient (no transition) to avoid any flash at toggle
    setIsGradientInstantHide(true);
    setIsGradientVisible(false);

    // Fade out current image (0.8s)
    setIsFadingOut(true);

    // Start preloading at ~200ms into the fade
    const preloadTimeout = setTimeout(() => {
      preloadImage(newBackgroundUrl).catch((err) => {
        console.error('Failed to preload hero background:', err);
      });
    }, 200);

    // After fade out completes (0.8s), swap image and fade in
    const swapTimeout = setTimeout(() => {
      setHeroBackground(newBackgroundUrl);
      // Remove fade-out class to trigger fade in (0.8s)
      setIsFadingOut(false);
      // Remove instant hide, then fade gradient back in to match hero
      setIsGradientInstantHide(false);
      setIsGradientVisible(true);
    }, 800);

    // After swap, fade gradient back in (1.2s)
    // No need to toggle gradient visibility; it stays mounted and fades via CSS

    return () => {
      clearTimeout(preloadTimeout);
      clearTimeout(swapTimeout);
      // nothing else
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
        className={`features-gradient ${isGradientVisible ? 'visible' : ''} ${isGradientInstantHide ? 'instant-hide' : ''}`}
      />
      <Features />
      <Pricing />
      {/* High-Accuracy Drum Scores section */}
      <Element />
      <Testimonials />
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
          <Route path="/stem-splitter" element={<StemSplitter onLoginClick={openLoginModal} />} />
          <Route path="/midi-converter" element={<MidiConverter onLoginClick={openLoginModal} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy onLoginClick={openLoginModal} />} />
          <Route path="/business-information" element={<BusinessInformation onLoginClick={openLoginModal} />} />
          <Route path="/terms" element={<TermsConditions onLoginClick={openLoginModal} />} />
          <Route path="/refund-policy" element={<RefundPolicy onLoginClick={openLoginModal} />} />
          <Route path="/sso-callback" element={<SSOCallback />} />
        </Routes>
        <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      </Router>
    </ThemeProvider>
  );
}

export default App;
