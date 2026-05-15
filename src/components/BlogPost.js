import React from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from './layout/Header';
import Footer from './layout/Footer';

// Placeholder route component for /blog/:slug.
// The full BlogPost component (renders the MDX/CMS post body) will replace
// this once the blog content pipeline lands. Kept as a real React component
// so production builds resolve the import in App.js.
function BlogPost({ onLoginClick }) {
  const { slug } = useParams();

  return (
    <div className="blog-post-page">
      <Header onLoginClick={onLoginClick} />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
        <p style={{ opacity: 0.6, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {slug}
        </p>
        <h1 style={{ marginTop: 16, fontSize: 32 }}>This post is coming soon.</h1>
        <p style={{ marginTop: 16, opacity: 0.75 }}>
          We are still polishing this article. In the meantime, browse the rest of the blog.
        </p>
        <p style={{ marginTop: 32 }}>
          <Link to="/blog">&larr; Back to blog</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default BlogPost;
