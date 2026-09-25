'use client';

import { useState } from 'react';
import './FAQ.css';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  items: FaqItem[];
}

interface FaqAccordionProps {
  title: string;
  sections: FaqSection[];
  /** Item open on first render, if any. */
  defaultOpenId?: string | null;
}

/**
 * The FAQ band's markup with its one piece of state, the open question. The
 * copy arrives already translated from the server, and every answer is in the
 * HTML whether or not it is expanded, so crawlers read all of it.
 */
export default function FaqAccordion({ title, sections, defaultOpenId = null }: FaqAccordionProps) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(defaultOpenId);

  const toggleQuestion = (id: string) => {
    setOpenQuestion((current) => (current === id ? null : id));
  };

  return (
    <section className="faq">
      <div className="faq-container">
        <h2 className="faq-title">{title}</h2>

        <div className="faq-sections">
          {sections.map((section) => (
            <div key={section.title} className="faq-section">
              <div className="faq-section-header">
                <div className="faq-section-label">
                  <h3 className="faq-section-title">{section.title}</h3>
                </div>

                <div className="faq-questions-column">
                  {section.items.map((item) => {
                    const isOpen = openQuestion === item.id;
                    return (
                      <div key={item.id} className={`faq-question-row ${isOpen ? 'open' : ''}`}>
                        <button
                          className="faq-question-button"
                          onClick={() => toggleQuestion(item.id)}
                          aria-expanded={isOpen}
                          aria-controls={`${item.id}-answer`}
                        >
                          <div className="faq-question-text">
                            <span>{item.question}</span>
                          </div>
                          <div className={`faq-icon ${isOpen ? 'open' : ''}`} aria-hidden="true">
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
                          aria-hidden={!isOpen}
                        >
                          <p>{item.answer}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
