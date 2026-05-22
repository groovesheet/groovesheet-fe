import React from 'react';
import { useTranslation } from 'react-i18next';
import './Testimonials.css';

function Testimonials() {
  const { t } = useTranslation();
  const testimonials = [
    {
      name: "Maya R.",
      role: t('testimonials.roles.sessionDrummer'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/d397764deae74f15b7f48f791add312f65ed4b3f?width=108",
      text: "I dumped a messy iPhone rehearsal into it and got a chart I could actually play. Tweaked two bars, printed, made soundcheck. That would've been an hour of guesswork otherwise."
    },
    {
      name: "Daniel Kim",
      role: t('testimonials.roles.drumTeacher'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/c73f1e048fe55b85e1b6320b7931df14f238ebf0?width=108",
      text: "Cuts my prep in half. I export to MusicXML, add stickings for the kids, and hand out PDFs. Fewer \"where do I come in?\" moments, more time actually playing."
    },
    {
      name: "LT (Leo Torres)",
      role: t('testimonials.roles.bandleader'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/5fec03ebf05d1fe87f7e3fcdf94883a9f8ec5c7d?width=108",
      text: "Night-before gig. Four songs. It mapped the forms right, so rehearsal wasn't us arguing the bridge. We just ran it and locked to the click."
    },
    {
      name: "Sofia.p",
      role: t('testimonials.roles.student'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/828d13d46426e34e55e1c9791687843b423f591a?width=108",
      text: "Slowed the tempo map, looped the chorus, finally nailed that triplet fill. Seeing the notes where I always rush was weirdly helpful."
    },
    {
      name: "Chris L.",
      role: t('testimonials.roles.producer'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/bfb895e7e522b847d88d47d14f14554781472f39?width=108",
      text: "Clients show up with a reference track and ten minutes later the drummer has parts. No more \"one more listen\" meetings. We just hit record."
    },
    {
      name: "Nora S.",
      role: t('testimonials.roles.musicEducator'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/83f7a2718c305ada58c462385f92a2a7f75a417f?width=108",
      text: "Spacing is readable and the kit names aren't cryptic. I throw the PDF on the projector and the whole class follows the repeats without me yelling counts."
    },
    {
      name: "@yuki_m",
      role: t('testimonials.roles.contentCreator'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/0789a3849272f19099c5068532844dea547f2a7b?width=108",
      text: "Batch three MP3s, download PDFs, drop into Premiere. That shaved a whole step off my tutorial workflow."
    },
    {
      name: "A. Rahman",
      role: t('testimonials.roles.studioOwner'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/6b7aef636b5442738df26c3ddcd06825a4490131?width=108",
      text: "Fast queue matters when sessions stack. Drummers spend less time decoding and more time playing to the click. Simple win."
    },
    {
      name: "\"K\"",
      role: t('testimonials.roles.beginner'),
      image: "https://api.builder.io/api/v1/image/assets/TEMP/3360f98ffe7757217f49139af104374389917716?width=108",
      text: "First charts I could follow end to end. Learned three songs this week without pausing YouTube every five seconds."
    }
  ];

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
          <div className="testimonials-column">
            {testimonials.slice(0, 3).map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-header">
                  <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar" />
                  <div className="testimonial-author">
                    <h4 className="testimonial-name">{testimonial.name}</h4>
                    <p className="testimonial-role">{testimonial.role}</p>
                  </div>
                </div>
                <p className="testimonial-text">{testimonial.text}</p>
              </div>
            ))}
          </div>

          <div className="testimonials-column">
            {testimonials.slice(3, 6).map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-header">
                  <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar" />
                  <div className="testimonial-author">
                    <h4 className="testimonial-name">{testimonial.name}</h4>
                    <p className="testimonial-role">{testimonial.role}</p>
                  </div>
                </div>
                <p className="testimonial-text">{testimonial.text}</p>
              </div>
            ))}
          </div>

          <div className="testimonials-column">
            {testimonials.slice(6, 9).map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-header">
                  <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar" />
                  <div className="testimonial-author">
                    <h4 className="testimonial-name">{testimonial.name}</h4>
                    <p className="testimonial-role">{testimonial.role}</p>
                  </div>
                </div>
                <p className="testimonial-text">{testimonial.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
