/* eslint-disable @next/next/no-img-element -- static photos from public/, same markup as the CRA page */
import { Circuitry, Handshake, ShieldCheck, Target } from '@phosphor-icons/react/dist/ssr';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import PartnerForm from './_components/PartnerForm';
import './_components/About.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/about', locale);
}

const VALUES = [
  {
    Icon: Circuitry,
    title: 'Innovation',
    description: 'We are committed to continuous innovation, providing cutting-edge solutions that drive success',
  },
  {
    Icon: Handshake,
    title: 'Collaboration',
    description:
      'We believe in the power of collaboration, working closely with our users to understand their unique needs',
  },
  {
    Icon: ShieldCheck,
    title: 'Integrity',
    description:
      'We uphold the highest standards of integrity in all our actions, ensuring honesty and transparency',
  },
  {
    Icon: Target,
    title: 'Excellence',
    description: 'We strive for excellence in everything we do, delivering top-quality services consistently',
  },
];

export default async function AboutPage(props: LocaleParams) {
  await routeLocale(props);

  return (
    <div className="about-page">
      <Header />

      <div className="about-container">
        <div className="about-content">
          {/* Hero Section */}
          <section className="about-hero">
            <div className="about-hero-text">
              <p className="about-label">About us</p>
              <h1 className="about-title">Make music learning accessible to all</h1>
              <p className="about-description">
                We build tools that helps musicians, educators, and creators learn faster, practice smarter, and unlock
                creative ideas.
              </p>
            </div>

            <div className="about-images">
              <div className="about-image-large">
                <img src="/images/about-office.png" alt="Office workspace" />
              </div>
              <div className="about-image-group">
                <div className="about-image-row">
                  <div className="about-image-small">
                    <img src="/images/about-meeting.png" alt="Team meeting" />
                  </div>
                  <div className="about-image-small">
                    <img src="/images/about-workspace.png" alt="Workspace" />
                  </div>
                </div>
                <div className="about-image-bottom">
                  <img src="/images/about-desk.png" alt="Workspace desk" />
                </div>
              </div>
            </div>
          </section>

          {/* Who We Are Section */}
          <section className="about-section">
            <div className="about-section-header">
              <p className="about-label">Who we are</p>
              <p className="about-section-description">
                Our story began with a simple idea: understanding music should be as natural as listening to it. Today
                we build AI-powered tools that help musicians, students, and creators turn any recording into something
                they can study, perform, and share.
              </p>
            </div>
          </section>

          {/* Our Values Section */}
          <section className="about-values">
            <div className="about-values-header">
              <p className="about-label">Our values</p>
              <p className="about-values-subtitle">
                We believe in forging strong relationships with our customers, partners, and employees, based on trust
                and mutual respect.
              </p>
            </div>

            <div className="values-grid">
              {VALUES.map(({ Icon, title, description }) => (
                <div key={title} className="value-card">
                  <div className="value-icon">
                    <Icon size={56} weight="regular" />
                  </div>
                  <h3 className="value-title">{title}</h3>
                  <p className="value-description">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Partner With Us Section */}
          <section className="about-partner">
            <div className="partner-text">
              <p className="about-label">Partner with us</p>
              <p className="partner-description">
                If you need results, GrooveSheet is here to give you that edge by cutting time and reducing costs. Let
                us help you take the first step.
              </p>
            </div>

            <PartnerForm />
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
