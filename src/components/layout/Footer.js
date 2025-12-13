import React from 'react';
import { Link } from 'react-router-dom';
import * as PhosphorIcons from '@phosphor-icons/react';
import { useTheme } from '../../context/ThemeContext';
import './Footer.css';

function Footer() {
  const { isDarkMode } = useTheme();
  const socialIcons = [
    { name: 'Facebook', component: 'FacebookLogo', href: '#facebook' },
    { name: 'Instagram', component: 'InstagramLogo', href: '#instagram' },
    { name: 'X', component: 'XLogo', href: '#x' },
    { name: 'YouTube', component: 'YoutubeLogo', href: '#youtube' },
    { name: 'TikTok', component: 'TiktokLogo', href: '#tiktok' },
    { name: 'Reddit', component: 'RedditLogo', href: '#reddit' },
    { name: 'GitHub', component: 'GithubLogo', href: '#github' },
    { name: 'WeChat', component: 'WechatLogo', href: '#wechat' },
    { name: 'LinkedIn', component: 'LinkedinLogo', href: '#linkedin' },
  ];

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <div className="footer-logo">
              <img src={isDarkMode ? "/images/Logo_White.png" : "/images/Logo_Dark.png"} alt="GrooveSheet" className="footer-logo-img" />
            </div>
            <div className="footer-social">
              <div className="social-icons">
                {socialIcons.map((icon, index) => {
                  const IconComponent = PhosphorIcons[icon.component];
                  return (
                    <a key={index} href={icon.href} className="social-icon" aria-label={icon.name}>
                      {IconComponent ? (
                        <IconComponent size={32} weight="fill" />
                      ) : (
                        // fallback: simple square if icon not found
                        <div
                          style={{ width: 32, height: 32, background: '#323033', borderRadius: 6 }}
                        />
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h3>Explore</h3>
              <a href="#pricing">Pricing</a>
              <a href="#api">API</a>
              <a href="#help">Help</a>
              <a href="#support">Support</a>
              <a href="#changelog">Changelog</a>
            </div>

            <div className="footer-column">
              <h3>Apps</h3>
              <a href="#desktop">Desktop App</a>
              <a href="#ios">iOS App</a>
              <a href="#android">Android App</a>
            </div>
          </div>

          <div className="footer-language">
            <div className="language-selector">
              <span>En</span>
              <svg
                width="16"
                height="10"
                viewBox="0 0 17 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8.53027 9.49994L1.03027 1.99994L2.08027 0.949938L8.53027 7.39994L14.9803 0.949938L16.0303 1.99994L8.53027 9.49994Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <Link to="/business-information" className="copyright">© 2025 DrumScore</Link>
            <div className="footer-legal">
              <Link to="/terms">Terms &amp; Conditions</Link>
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/refund-policy">Refund Policy</Link>
            </div>
          </div>

          <div className="footer-bottom-right">
            <span>Care to share on Trustpilot? </span>
            <a href="#review">Review Us</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
