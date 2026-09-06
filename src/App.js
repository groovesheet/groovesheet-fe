import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/layout/Header';
import Hero from './components/Hero';
import HeroBackground from './components/HeroBackground';
import Features from './components/Features';
import ProcessingJobs from './components/ProcessingJobs';
import Pricing from './components/Pricing';
import Testimonials from './components/Testimonials';
import FAQ from './components/FAQ';
import Footer from './components/layout/Footer';
import { LoginModal } from './components/LoginModal';
import TranscriptionHistory from './components/TranscriptionHistory';
import TranscriptionDetail from './components/TranscriptionDetail';
import SSOCallback from './components/SSOCallback';
import Blog from './components/Blog';
import BlogPost from './components/BlogPost';
import Changelog from './components/Changelog';
import About from './components/About';
import StemSplitter from './components/StemSplitter';
import MidiConverter from './components/MidiConverter';
import ApiPage from './components/ApiPage';
import HelpSupport from './components/HelpSupport';
import Explore from './components/Explore';
import SearchResults from './components/explore/SearchResults';
import SongDetail from './components/song/SongDetail';
import CreatorProfile from './components/creator/CreatorProfile';
import Element from './components/Element';
import PrivacyPolicy from './components/PrivacyPolicy';
import BusinessInformation from './components/BusinessInformation';
import TermsConditions from './components/TermsConditions';
import RefundPolicy from './components/RefundPolicy';
import PreviewDemo from './components/PreviewDemo';
import Video1 from './components/video/Video1';
import ServiceStatus from './components/ServiceStatus';
import Video2Tabs from './components/video/Video2Tabs';
import Video2Drums from './components/video/Video2Drums';
import { Video2Guitar, Video2Bass } from './components/video/Video2Instrument';
import BillingSuccess from './components/BillingSuccess';
import PricingPage from './components/PricingPage';
import NotFound from './components/NotFound';
import CampaignPage from './components/CampaignPage';
import AccountBilling from './components/AccountBilling';
import AccountProfile from './components/AccountProfile';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useUser, useAuth } from './auth';
import { claimPendingPreviewIfAny } from './utils/previewApi';
import { claimPendingCampaignIfAny } from './utils/api';
import config from './config';
import { LocaleScope, LocaleSync } from './i18n/locale';
import usePageMeta from './hooks/usePageMeta';

function LandingPage({ onLoginClick }) {
  usePageMeta(
    'Audio to Sheet Music, Stems & MIDI',
    'Turn any song into sheet music. AI transcription for drums, piano and bass, '
      + 'plus vocal removal, stem separation and audio to MIDI. Export PDF, '
      + 'MusicXML and MIDI.'
  );

  const { isDarkMode } = useTheme();
  const gradientRef = useRef(null);
  const [isGradientVisible, setIsGradientVisible] = useState(false);
  const [isGradientInstantHide, setIsGradientInstantHide] = useState(false);

  // Gradient timing mirrors the HeroBackground fade: instant-hide at theme
  // toggle, fade back in once the background has swapped (0.8s).
  useEffect(() => {
    // Instantly hide gradient (no transition) to avoid any flash at toggle
    setIsGradientInstantHide(true);
    setIsGradientVisible(false);

    const swapTimeout = setTimeout(() => {
      setIsGradientInstantHide(false);
      setIsGradientVisible(true);
    }, 800);

    return () => {
      clearTimeout(swapTimeout);
    };
  }, [isDarkMode]);

  return (
    <div className="app-container">
      <div className="dot-grid"></div>
      <HeroBackground />
      <Header onLoginClick={onLoginClick} />
      <Hero onLoginRequired={onLoginClick} />
      <div
        ref={gradientRef}
        className={`features-gradient ${isGradientVisible ? 'visible' : ''} ${isGradientInstantHide ? 'instant-hide' : ''}`}
      />
      <div style={{ paddingTop: '120px' }}>
        {/* In-flight jobs, right under the uploader, so leaving this page never loses sight of them. */}
        <ProcessingJobs />
        <Features />
      </div>
      <Pricing onLoginClick={onLoginClick} />
      {/* High-Accuracy Drum Scores section */}
      <Element />
      <Testimonials />
      <FAQ />
      <Footer />
    </div>
  );
}

// When a previously-anonymous user signs in, claim any pending preview they
// uploaded before signing up, and grant the one-time signup-bonus credits.
// Mounted once at the App root; safe no-op when nothing is pending.
function PendingPreviewClaimRunner() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await claimPendingPreviewIfAny(config.apiBaseUrl, getToken);
        if (!cancelled && result) {
          console.info('Pending preview claimed:', result);
        }
      } catch (err) {
        console.warn('Pending preview claim failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn, isLoaded, getToken]);

  return null;
}

// A visitor who signed up through a /signup/:code link may land anywhere after
// the OAuth round trip, so the campaign grant is claimed app-wide rather than
// only on the campaign page. Idempotent server-side; a no-op with no pending code.
function PendingCampaignClaimRunner() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    // The campaign page claims for itself while it is mounted, so that it can
    // render the "credit granted" state. Claiming from here too would race it
    // and win often enough to show "already claimed" to someone who just
    // signed up.
    if (/^\/(zh-CN\/|zh-TW\/)?signup\//.test(window.location.pathname)) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await claimPendingCampaignIfAny('/api', getToken);
        if (!cancelled && result) {
          console.info('Campaign credit claimed:', result);
        }
      } catch (err) {
        console.warn('Campaign claim failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn, isLoaded, getToken]);

  return null;
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

  const appRoutes = (
    <Routes>
      <Route index element={<LandingPage onLoginClick={openLoginModal} />} />
      <Route path="pricing" element={<PricingPage onLoginClick={openLoginModal} />} />
      <Route path="account/history" element={<TranscriptionHistory />} />
      {/* Owner-only song page — the private counterpart of /explore/:songId. */}
      <Route path="transcription-history/:workflowId" element={<TranscriptionDetail />} />
      <Route path="transcription-history" element={<Navigate to="/account/history" replace />} />
      <Route path="history" element={<Navigate to="/account/history" replace />} />
      <Route path="account/billing" element={<AccountBilling />} />
      <Route path="account/profile" element={<AccountProfile />} />
      <Route path="profile" element={<Navigate to="/account/profile" replace />} />
      <Route path="blog" element={<Blog onLoginClick={openLoginModal} />} />
      <Route path="blog/:slug" element={<BlogPost onLoginClick={openLoginModal} />} />
      <Route path="about" element={<About onLoginClick={openLoginModal} />} />
      <Route path="changelog" element={<Changelog onLoginClick={openLoginModal} />} />
      <Route path="stem-splitter" element={<StemSplitter onLoginClick={openLoginModal} />} />
      <Route path="midi-converter" element={<MidiConverter onLoginClick={openLoginModal} />} />
      <Route path="developers" element={<ApiPage onLoginClick={openLoginModal} />} />
      <Route path="help" element={<HelpSupport onLoginClick={openLoginModal} />} />
      <Route path="explore" element={<Explore onLoginClick={openLoginModal} />} />
      {/* Static segment, so it wins over explore/:songId regardless of order. */}
      <Route path="explore/search" element={<SearchResults onLoginClick={openLoginModal} />} />
      <Route path="explore/:songId" element={<SongDetail onLoginClick={openLoginModal} />} />
      <Route path="u/:username" element={<CreatorProfile onLoginClick={openLoginModal} />} />
      <Route path="privacy-policy" element={<PrivacyPolicy onLoginClick={openLoginModal} />} />
      <Route path="business-information" element={<BusinessInformation onLoginClick={openLoginModal} />} />
      <Route path="terms" element={<TermsConditions onLoginClick={openLoginModal} />} />
      <Route path="refund-policy" element={<RefundPolicy onLoginClick={openLoginModal} />} />
      <Route path="signup/:code" element={<CampaignPage />} />
      <Route path="sso-callback" element={<SSOCallback />} />
      <Route path="preview1" element={<PreviewDemo />} />
      <Route path="video1" element={<Video1 />} />
      <Route path="video2forpiano" element={<Video2Tabs />} />
      <Route path="video2fordrums" element={<Video2Drums />} />
      <Route path="video2forguitar" element={<Video2Guitar />} />
      <Route path="video2forbass" element={<Video2Bass />} />
      <Route path="service-status" element={<ServiceStatus />} />
      <Route path="billing/success" element={<BillingSuccess />} />
      <Route path="*" element={<NotFound onLoginClick={openLoginModal} />} />
    </Routes>
  );

  return (
    <ThemeProvider>
      <Router>
        <PendingPreviewClaimRunner />
        <PendingCampaignClaimRunner />
        <LocaleSync />
        <Routes>
          <Route
            path="/zh-CN/*"
            element={<LocaleScope locale="zh-CN">{appRoutes}</LocaleScope>}
          />
          <Route
            path="/zh-TW/*"
            element={<LocaleScope locale="zh-TW">{appRoutes}</LocaleScope>}
          />
          <Route path="/*" element={<LocaleScope locale="en">{appRoutes}</LocaleScope>} />
        </Routes>
        <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      </Router>
    </ThemeProvider>
  );
}

export default App;
