import React, { useState } from 'react';
import './FAQ.css';

function FAQ() {
  // section grouping currently not collapsible; keeping simple openQuestion state for individual items
  const [openQuestion, setOpenQuestion] = useState(null);

  // sections are not collapsible in this simplified layout; keep state available for future use

  const toggleQuestion = (question) => {
    setOpenQuestion(openQuestion === question ? null : question);
  };

  const faqData = [
    {
      section: 'Overview',
      questions: [
        {
          id: 'signup',
          question: 'How do I sign up/sign in?',
          answer:
            'Use the Sign up / Sign in button in the top-right to create an account or sign in with SSO. After signing in you can access paid features from your account page.',
        },
        {
          id: 'split',
          question: 'How do I split a full track?',
          answer:
            'Upload the full track and use the split controls in the editor to choose segments. You can then process each segment separately.',
        },
      ],
    },
    {
      section: 'Packs and Minutes',
      questions: [
        {
          id: 'expiration',
          question: 'What is the expiration date on paid packages?',
          answer:
            'Paid packages expire 12 months from the purchase date unless otherwise specified in the package details.',
        },
        {
          id: 'minutes-mean',
          question: 'What does the "number of minutes in a pack" mean?',
          answer:
            'The minutes indicate the total processing audio time included in the pack; longer tracks use more minutes proportionally.',
        },
        {
          id: 'deducted',
          question: 'How are the minutes deducted from my account?',
          answer:
            'Minutes are deducted based on the length of audio you process. Partial minutes round up to the nearest second as described in billing.',
        },
        {
          id: 'remaining',
          question: 'Where can I see the number of remaining minutes?',
          answer:
            "Your remaining minutes are shown on your account dashboard under 'Billing & Usage'.",
        },
        {
          id: 'job-fails',
          question: 'What happens if a job fails?',
          answer:
            "If a job fails we'll retry automatically; if it still fails we won't deduct minutes and you'll see a failure notice with options to retry or contact support.",
        },
        {
          id: 'add-minutes',
          question: 'How can I add more minutes to my account?',
          answer:
            'Visit the Pricing page and select an add-on pack or upgrade to a higher plan to increase your minutes.',
        },
      ],
    },
    {
      section: 'Features',
      questions: [
        {
          id: 'quality',
          question: 'How do I improve the notation quality?',
          answer:
            'Use higher-quality recordings, reduce background noise, and provide clear instrument separation for best results.',
        },
        {
          id: 'live',
          question: 'Will it work on live recordings?',
          answer:
            'Live recordings may work but results vary; studio-quality or clean recordings produce the best notation.',
        },
        {
          id: 'meters',
          question: 'Does it handle odd meters and tempo changes?',
          answer:
            'Yes — the system detects tempo changes and odd meters, but accuracy improves with clear rhythmic content.',
        },
        {
          id: 'format',
          question: 'In what format will I receive the results?',
          answer: 'You can download results as PDF, MusicXML, and MIDI depending on your plan.',
        },
      ],
    },
  ];

  return (
    <section className="faq">
      <div className="faq-container">
        <h2 className="faq-title">FAQ</h2>

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
