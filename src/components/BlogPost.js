import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import Header from './layout/Header';
import Footer from './layout/Footer';
import { fetchBlogPostBySlug } from '../utils/blog';
import './BlogPost.css';

function BlogPost({ onLoginClick }) {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPost(null);
    fetchBlogPostBySlug(slug)
      .then((row) => {
        if (!cancelled) setPost(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load post');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="blog-post-page">
      <Header onLoginClick={onLoginClick} />

      <main className="blog-post-main">
        <div className="blog-post-container">
          <Link to="/blog" className="blog-post-back">
            ← Back to blog
          </Link>

          {loading && <p className="blog-post-status">Loading…</p>}
          {error && !loading && (
            <p className="blog-post-status blog-post-status-error">
              Couldn’t load this post: {error}
            </p>
          )}
          {!loading && !error && !post && (
            <div className="blog-post-status">
              <h1>Post not found</h1>
              <p>The post you’re looking for doesn’t exist or hasn’t been published yet.</p>
            </div>
          )}

          {post && (
            <article className="blog-post-article">
              <header className="blog-post-article-header">
                <div className="blog-post-article-meta">
                  <span>{post.date}</span>
                  <span className="blog-post-article-dot" />
                  <span>{post.readTime}</span>
                  <span className="blog-post-article-dot" />
                  <span>{post.author}</span>
                </div>
                <h1 className="blog-post-article-title">{post.title}</h1>
                {post.excerpt && (
                  <p className="blog-post-article-excerpt">{post.excerpt}</p>
                )}
              </header>

              {post.coverImageUrl && (
                <div
                  className="blog-post-article-cover"
                  style={{ backgroundImage: `url(${post.coverImageUrl})` }}
                />
              )}

              <div className="blog-post-article-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {post.bodyMd}
                </ReactMarkdown>
              </div>
            </article>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default BlogPost;
