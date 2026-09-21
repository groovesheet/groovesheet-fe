/**
 * Site footer. A Client Component because the logo follows the theme toggle.
 */
'use client';

import {
  FacebookLogo,
  InstagramLogo,
  XLogo,
  YoutubeLogo,
  TiktokLogo,
  RedditLogo,
  GithubLogo,
  LinkedinLogo,
  DiscordLogo,
  DevToLogo,
  SoundcloudLogo,
  MediumLogo,
  ThreadsLogo,
  TumblrLogo,
  TwitchLogo,
  PinterestLogo,
  type Icon,
} from '@phosphor-icons/react';
import { useTheme } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';
import { LocalizedLink } from '@/lib/navigation';
import { LanguageSelector } from './LanguageSelector';
import TrustBox from './TrustBox';
import './Footer.css';

interface SocialIcon {
  name: string;
  component: Icon;
  href: string;
}

function Footer() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const socialIcons: SocialIcon[] = [
    {
      name: 'Facebook',
      component: FacebookLogo,
      href: 'https://www.facebook.com/profile.php?id=61584710236945',
    },
    {
      name: 'Instagram',
      component: InstagramLogo,
      href: 'https://www.instagram.com/groovesheet/',
    },
    { name: 'X', component: XLogo, href: 'https://x.com/groovesheet_' },
    { name: 'YouTube', component: YoutubeLogo, href: 'https://www.youtube.com/@GrooveSheet_AI' },
    { name: 'TikTok', component: TiktokLogo, href: 'https://www.tiktok.com/@groovesheet' },
    { name: 'Reddit', component: RedditLogo, href: 'https://www.reddit.com/user/groovesheet/' },
    { name: 'GitHub', component: GithubLogo, href: 'https://github.com/groovesheet' },
    {
      name: 'LinkedIn',
      component: LinkedinLogo,
      href: 'https://www.linkedin.com/in/groovesheet/',
    },
    { name: 'Discord', component: DiscordLogo, href: 'https://discord.gg/ptfn6ZYDHV' },
    { name: 'Dev.to', component: DevToLogo, href: 'https://dev.to/groovesheet' },
    { name: 'SoundCloud', component: SoundcloudLogo, href: 'https://soundcloud.com/groovesheet' },
    { name: 'Medium', component: MediumLogo, href: 'https://medium.com/@groovesheet/about' },
    { name: 'Threads', component: ThreadsLogo, href: 'https://www.threads.com/@groovesheet' },
    { name: 'Tumblr', component: TumblrLogo, href: 'https://www.tumblr.com/groovesheet' },
    { name: 'Twitch', component: TwitchLogo, href: 'https://www.twitch.tv/groovesheet' },
    {
      name: 'Pinterest',
      component: PinterestLogo,
      href: 'https://www.pinterest.com/groovesheet/',
    },
  ];

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <div className="footer-logo">
              <img
                src={isDarkMode ? '/images/Logo_White.png' : '/images/Logo_Dark.png'}
                alt="GrooveSheet"
                className="footer-logo-img"
              />
            </div>
            <div className="footer-social">
              <div className="social-icons">
                {socialIcons.map((icon) => {
                  const IconComponent = icon.component;
                  return (
                    <a key={icon.name} href={icon.href} className="social-icon" aria-label={icon.name}>
                      <IconComponent size={32} weight="fill" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h3>{t('footer.explore')}</h3>
              <a href="#pricing">{t('footer.pricing')}</a>
              <a href="#api">{t('footer.api')}</a>
              <LocalizedLink to="/help">{t('footer.help')}</LocalizedLink>
              <LocalizedLink to="/help">{t('footer.support')}</LocalizedLink>
              <a href="#changelog">{t('footer.changelog')}</a>
            </div>

            <div className="footer-column">
              <h3>{t('footer.apps')}</h3>
              <a href="#desktop">{t('footer.desktopApp')}</a>
              <a href="#ios">{t('footer.iosApp')}</a>
              <a href="#android">{t('footer.androidApp')}</a>
            </div>
          </div>

          <div className="footer-language">
            <LanguageSelector />
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <LocalizedLink to="/business-information" className="copyright">
              {t('footer.copyright', { year })}
            </LocalizedLink>
            <div className="footer-legal">
              <LocalizedLink to="/terms">{t('footer.terms')}</LocalizedLink>
              <LocalizedLink to="/privacy-policy">{t('footer.privacy')}</LocalizedLink>
              <LocalizedLink to="/refund-policy">{t('footer.refund')}</LocalizedLink>
            </div>
          </div>

          <div className="footer-bottom-right">
            <TrustBox />
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
