// Inline SVG icons for the song detail page.
// Ported verbatim from the Anthropic design pack so the visuals match 1:1.
import React from 'react';

export const Icon = {
  ChevronLeft: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronDown: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Eye: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Star: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  Heart: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Comment: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Verified: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M9 12l2 2 4-4M21 12c0 1.66-.59 3.18-1.58 4.36.13.5.21 1.02.21 1.55 0 3.3-2.68 5.97-5.97 5.97-.53 0-1.05-.07-1.55-.21A7 7 0 0 1 12 23c-1.66 0-3.18-.59-4.36-1.58-.5.13-1.02.21-1.55.21A5.97 5.97 0 0 1 .12 17.66c-.07-.45-.12-.91-.12-1.36 0-1.66.59-3.18 1.58-4.36A7 7 0 0 1 1 12c0-1.66.59-3.18 1.58-4.36C2.45 7.14 2.4 6.62 2.4 6.09 2.4 2.79 5.08.12 8.37.12c.53 0 1.05.07 1.55.21A7 7 0 0 1 12 .12c1.66 0 3.18.59 4.36 1.58.5-.13 1.02-.21 1.55-.21 3.3 0 5.97 2.68 5.97 5.97 0 .53-.07 1.05-.21 1.55A7 7 0 0 1 23.88 12c0 .45-.05.91-.12 1.36-.99 1.18-1.58 2.7-1.58 4.36z" />
    </svg>
  ),
  Logo: (p) => (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" {...p}>
      <rect width="32" height="32" rx="7" fill="#012FA7" />
      <path d="M9 22V10h3l4 7 4-7h3v12h-2.5v-7l-3.4 6h-2.2l-3.4-6v7H9z" fill="#fff" />
      <circle cx="24" cy="22.5" r="2.5" fill="#fff" />
      <line x1="26.4" y1="22.5" x2="26.4" y2="12" stroke="#fff" strokeWidth="1.5" />
    </svg>
  ),
  Sheet: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <circle cx="8" cy="11" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  Midi: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="3" y="6" width="5" height="4" rx="1" />
      <rect x="10" y="6" width="11" height="4" rx="1" />
      <rect x="3" y="12" width="8" height="4" rx="1" />
      <rect x="13" y="12" width="8" height="4" rx="1" />
    </svg>
  ),
  Stems: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <line x1="4" y1="9" x2="4" y2="15" />
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="16" y1="7" x2="16" y2="17" />
      <line x1="20" y1="9" x2="20" y2="15" />
    </svg>
  ),
  // Playback transport
  Prev: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  ),
  Next: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  ),
  Play: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Pause: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Loop: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  Vol: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  VolMute: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  ),
  Metronome: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="6 22 4 22 7 4 17 4 20 22 18 22" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="12" y1="14" x2="14" y2="6" />
    </svg>
  ),
  Sun: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  Moon: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  ),
  Fullscreen: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  Minus: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Plus: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </svg>
  ),
  // Sidebar actions
  Download: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Print: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  Bookmark: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Share: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Edit: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Course: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
};

export default Icon;
