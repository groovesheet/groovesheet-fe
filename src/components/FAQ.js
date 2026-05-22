import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './FAQ.css';

function FAQ() {
  const { t } = useTranslation();
  const [openQuestion, setOpenQuestion] = useState(null);

  const toggleQuestion = (question) => {
    setOpenQuestion(openQuestion === question ? null : question);
  };

  const sectionsDef = [
    { key: 'overview', items: ['signup', 'split'] },
    {
      key: 'packs',
      items: ['expiration', 'minutesMean', 'deducted', 'remaining', 'jobFails', 'addMinutes'],
    },
    { key: 'features', items: ['quality', 'live', 'meters', 'format'] },
  ];

  const faqData = sectionsDef.map(({ key, items }) => ({
    section: t(`faq.sections.${key}.title`),
    questions: items.map((id) => ({
      id: `${key}-${id}`,
      question: t(`faq.sections.${key}.questions.${id}.q`),
      answer: t(`faq.sections.${key}.questions.${id}.a`),
    })),
  }));

  return (
    <section className="faq">
      <div className="faq-container">
        <h2 className="faq-title">{t('faq.title')}</h2>

        <div className="faq-sections">
          {faqData.map((section, sectionIndex) => (
            <div key={sectionIndex} className="faq-section">
              <div className="faq-section-header">
                <div className="faq-section-label">
                  <h3 className="faq-section-title">{section.section}</h3>
                </div>

                <div className="faq-questions-column">
                  {section.questions.map((item) => (
                    <div
                      key={item.id}
                      className={`faq-question-row ${openQuestion === item.id ? 'open' : ''}`}
                    >
                      <button
                        className="faq-question-button"
                        onClick={() => toggleQuestion(item.id)}
                        aria-expanded={openQuestion === item.id}
                        aria-controls={`${item.id}-answer`}
                      >
                        <div className="faq-question-text">
                          <span>{item.question}</span>
                        </div>
                        <div
                          className={`faq-icon ${openQuestion === item.id ? 'open' : ''}`}
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 24 24" className="faq-icon-svg">
                            <path
                              d="M6 10l6 6 6-6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </button>

                      <div
                        id={`${item.id}-answer`}
                        className="faq-answer"
                        role="region"
                        aria-hidden={openQuestion !== item.id}
                      >
                        {/* Placeholder answer text — replace with real answers as needed */}
                        <p>
                          {item.answer ||
                            'This is the answer to the question. Add real content here.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FAQ;
