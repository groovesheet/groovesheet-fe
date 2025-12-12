import React, { useState, useEffect } from 'react';
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

// Function to get a random dark hero background image
const getRandomHeroBackground = () => {
  const darkImages = ['Dark1.png', 'Dark2.png', 'Dark3.png', 'Dark4.png', 'Dark5.png', 'Dark6.png', 'Dark7.png', 'Dark8.png'];
  const randomImage = darkImages[Math.floor(Math.random() * darkImages.length)];
  return `${process.env.PUBLIC_URL}/images/hero-section/${randomImage}`;
};

function LandingPage({ onLoginClick }) {
  const [heroBackground, setHeroBackground] = useState('');

  useEffect(() => {
    setHeroBackground(getRandomHeroBackground());
  }, []);

  return (
    <div className="app-container">
      <div className="dot-grid"></div>
      <div
        className="hero-background"
        style={{ backgroundImage: `url(${heroBackground})` }}
      ></div>
      <Header onLoginClick={onLoginClick} />
      <Hero onLoginRequired={onLoginClick} />
      <div className="features-gradient" />
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
  );
}

export default App;
