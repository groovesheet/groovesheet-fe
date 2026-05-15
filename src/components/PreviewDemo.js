import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';

// Placeholder route component for /preview-demo-1.
// The full PreviewDemo (interactive walkthrough of the preview pipeline)
// will replace this once the demo content lands. Kept as a real component
// so production builds resolve the import in App.js.
function PreviewDemo() {
  return (
    <div className="preview-demo-page">
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32 }}>Preview demo coming soon.</h1>
        <p style={{ marginTop: 16, opacity: 0.75 }}>
          We are still putting this walkthrough together. Please check back shortly.
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default PreviewDemo;
