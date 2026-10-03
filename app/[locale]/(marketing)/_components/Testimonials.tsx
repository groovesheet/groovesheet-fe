/* eslint-disable @next/next/no-img-element -- remote avatars from the design CDN, same markup as the CRA page */
import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/lib/locales';
import './Testimonials.css';

interface Testimonial {
  name: string;
  role: string;
  image: string;
  text: string;
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="testimonial-card">
      <div className="testimonial-header">
        <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar" />
        <div className="testimonial-author">
          <h4 className="testimonial-name">{testimonial.name}</h4>
          <p className="testimonial-role">{testimonial.role}</p>
        </div>
      </div>
      <p className="testimonial-text">{testimonial.text}</p>
    </div>
  );
}

export default async function Testimonials({ locale }: { locale: Locale }) {
  const t = await getT(locale);
  const testimonials: Testimonial[] = [
    {
      name: 'Maya R.',
      role: t('testimonials.roles.sessionDrummer'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/d397764deae74f15b7f48f791add312f65ed4b3f?width=108',
      text: t('testimonials.quotes.maya'),
    },
    {
      name: 'Daniel Kim',
      role: t('testimonials.roles.drumTeacher'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/c73f1e048fe55b85e1b6320b7931df14f238ebf0?width=108',
      text: t('testimonials.quotes.daniel'),
    },
    {
      name: 'LT (Leo Torres)',
      role: t('testimonials.roles.bandleader'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/5fec03ebf05d1fe87f7e3fcdf94883a9f8ec5c7d?width=108',
      text: t('testimonials.quotes.leo'),
    },
    {
      name: 'Sofia.p',
      role: t('testimonials.roles.student'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/828d13d46426e34e55e1c9791687843b423f591a?width=108',
      text: t('testimonials.quotes.sofia'),
    },
    {
      name: 'Chris L.',
      role: t('testimonials.roles.producer'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/bfb895e7e522b847d88d47d14f14554781472f39?width=108',
      text: t('testimonials.quotes.chris'),
    },
    {
      name: 'Nora S.',
      role: t('testimonials.roles.musicEducator'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/83f7a2718c305ada58c462385f92a2a7f75a417f?width=108',
      text: t('testimonials.quotes.nora'),
    },
    {
      name: '@yuki_m',
      role: t('testimonials.roles.contentCreator'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/0789a3849272f19099c5068532844dea547f2a7b?width=108',
      text: t('testimonials.quotes.yuki'),
    },
    {
      name: 'A. Rahman',
      role: t('testimonials.roles.studioOwner'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/6b7aef636b5442738df26c3ddcd06825a4490131?width=108',
      text: t('testimonials.quotes.rahman'),
    },
    {
      name: '"K"',
      role: t('testimonials.roles.beginner'),
      image: 'https://api.builder.io/api/v1/image/assets/TEMP/3360f98ffe7757217f49139af104374389917716?width=108',
      text: t('testimonials.quotes.k'),
    },
  ];

  const columns = [testimonials.slice(0, 3), testimonials.slice(3, 6), testimonials.slice(6, 9)];

  return (
    <section className="testimonials">
      <div className="testimonials-container">
        <div className="testimonials-header">
          <div className="testimonials-title-section">
            <h2 className="testimonials-title">{t('testimonials.title')}</h2>
          </div>
          <p className="testimonials-subtitle">{t('testimonials.subtitle')}</p>
        </div>

        <div className="testimonials-grid">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="testimonials-column">
              {column.map((testimonial) => (
                <TestimonialCard key={testimonial.name} testimonial={testimonial} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
