import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import '../_components/LegalPage.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/business-information', locale, {
    description:
      'GrooveSheet is operated by USEFOOL TECHNOLOGY PRIVATE LIMITED, Hong Kong. Registration number, registered address and business contact details.',
  });
}

export default async function BusinessInformationPage(props: LocaleParams) {
  await routeLocale(props);

  return (
    <div className="legal-page">
      <Header />
      <main className="legal-container">
        <section className="legal-content">
          <h1 className="legal-title">Business Information</h1>
          <div className="legal-body">
            <div className="legal-section">
              <p className="legal-text">
                GrooveSheet is operated by USEFOOL TECHNOLOGY PRIVATE LIMITED (Hong Kong).
              </p>
              <p className="legal-text">Hong Kong Business Registration No.: 77709205 (Established 2025)</p>
              <p className="legal-text">
                Registered Address: Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy, Central, Hong Kong S.A.R.
              </p>
              <p className="legal-text">Phone: +65 8575 5666</p>
              <p className="legal-text">Email: business@usefool-ai.com</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

