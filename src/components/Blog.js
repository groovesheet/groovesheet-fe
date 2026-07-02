import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from './layout/Header';
import Footer from './layout/Footer';
import * as PhosphorIcons from '@phosphor-icons/react';
import { fetchBlogPosts } from '../utils/blog';
import SkeletonPanel from './ui/SkeletonPanel';
import StatusMessage from './ui/StatusMessage';
import './Blog.css';

const socialIcons = [
  { name: 'Facebook', component: 'FacebookLogo', href: '#facebook' },
  { name: 'Instagram', component: 'InstagramLogo', href: '#instagram' },
  { name: 'X', component: 'XLogo', href: '#x' },
  { name: 'YouTube', component: 'YoutubeLogo', href: '#youtube' },
  { name: 'TikTok', component: 'TiktokLogo', href: '#tiktok' },
  { name: 'Reddit', component: 'RedditLogo', href: '#reddit' },
  { name: 'WeChat', component: 'WechatLogo', href: '#wechat' },
  { name: 'GitHub', component: 'GithubLogo', href: '#github' },
  { name: 'LinkedIn', component: 'LinkedinLogo', href: '#linkedin' },
];

function BlogPostCard({ post }) {
  const imageStyle = post.coverImageUrl
    ? { backgroundImage: `url(${post.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  const inner = post.featured ? (
    <div className={`blog-post-card ${post.size}`}>
      <div className="blog-post-image" style={imageStyle} />
      <div className="blog-post-content blog-post-content-overlay">
        <div className="blog-post-meta">
          <span className="blog-post-date">{post.date}</span>
          <span className="blog-post-divider"></span>
          <span className="blog-post-read-time">{post.readTime}</span>
        </div>
        <h3 className="blog-post-title">{post.title}</h3>
        {post.excerpt && <p className="blog-post-excerpt">{post.excerpt}</p>}
      </div>
    </div>
  ) : (
    <div className={`blog-post-card ${post.size}`}>
      <div className="blog-post-image" style={imageStyle} />
      <div className="blog-post-content">
        <div className="blog-post-info">
          <div className="blog-post-meta">
            <span className="blog-post-date">{post.date}</span>
            <span className="blog-post-divider"></span>
            <span className="blog-post-read-time">{post.readTime}</span>
          </div>
          <h3 className="blog-post-title">{post.title}</h3>
        </div>
        {post.excerpt && <p className="blog-post-excerpt">{post.excerpt}</p>}
      </div>
    </div>
  );

  return (
    <Link to={`/blog/${post.slug}`} className="blog-post-link" aria-label={post.title}>
      {inner}
    </Link>
  );
}

function Blog({ onLoginClick }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchBlogPosts()
      .then((rows) => {
        if (!cancelled) setPosts(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load posts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredPosts = posts.filter((p) => p.featured);
  const regularPosts = posts.filter((p) => !p.featured);

  const postRows = [];
  for (let i = 0; i < regularPosts.length; i += 3) {
    postRows.push(regularPosts.slice(i, i + 3));
  }

  return (
    <div className="blog-page">
      <Header onLoginClick={onLoginClick} />

      <main className="blog-main">
        <div className="blog-container">
          <section className="blog-title-section">
            <div className="blog-title-left">
              <h1 className="blog-title">Blog, news and updates</h1>
              <p className="blog-subtitle">Get the latest news and updates from GrooveSheet</p>
            </div>
            <div className="blog-title-icons" aria-label="Social channels">
              {socialIcons.map((icon, idx) => {
                const IconComponent = PhosphorIcons[icon.component];
                if (idx > 8) return null;
                return (
                  <a
                    key={icon.name}
                    href={icon.href}
                    className="blog-title-icon"
                    aria-label={icon.name}
                    title={icon.name}
                  >
                    <IconComponent size={40} weight="fill" />
                  </a>
                );
              })}
            </div>
          </section>

          {loading && <SkeletonPanel count={3} height={120} />}
          {error && !loading && (
            <StatusMessage variant="error" title="Couldn’t load posts">{error}</StatusMessage>
          )}
          {!loading && !error && posts.length === 0 && (
            <p className="blog-status">No posts yet. Check back soon.</p>
          )}

          {featuredPosts.length > 0 && (
            <section className="featured-posts-section">
              {featuredPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </section>
          )}

          {postRows.length > 0 && (
            <section className="blog-posts-section">
              {postRows.map((row, rowIndex) => (
                <div key={rowIndex} className="blog-posts-row">
                  {row.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>
              ))}
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Blog;
