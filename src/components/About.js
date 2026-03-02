import React, { useState } from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import * as PhosphorIcons from '@phosphor-icons/react';
import './About.css';

function About({ onLoginClick }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!consent) {
      alert('Please agree to the terms before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const HUBSPOT_PORTAL_ID = process.env.REACT_APP_HUBSPOT_PORTAL_ID;
      const HUBSPOT_FORM_GUID = process.env.REACT_APP_HUBSPOT_FORM_GUID;
      
      // Check if credentials are available
      if (!HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_GUID) {
        console.error('HubSpot credentials not configured');
        setSubmitStatus('error');
        setIsSubmitting(false);
        return;
      }

      console.log('Submitting to HubSpot:', { HUBSPOT_PORTAL_ID, HUBSPOT_FORM_GUID });
      
      // Use HubSpot's CORS-friendly endpoint
      const response = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: [
              {
                name: 'firstname',
                value: formData.name
              },
              {
                name: 'email',
                value: formData.email
              },
              ...(formData.message ? [{
                name: 'message',
                value: formData.message
              }] : [])
            ],
            context: {
              pageUri: window.location.href,
              pageName: 'About - Partner Form'
            },
            legalConsentOptions: {
              consent: {
                consentToProcess: true,
                text: 'I agree that GrooveSheet can use this information to get in touch with me and provide the details I requested.',
                communications: [
                  {
                    value: true,
                    subscriptionTypeId: 999,
                    text: 'I agree to receive marketing communications from GrooveSheet.'
                  }
                ]
              }
            }
          })
        }
      );

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', message: '' });
        setConsent(false);
      } else {
        const errorText = await response.text();
        console.error('HubSpot submission error:', response.status, errorText);
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="about-page">
      <Header onLoginClick={onLoginClick} />
      
      <div className="about-container">
        <div className="about-content">
          {/* Hero Section */}
          <section className="about-hero">
            <div className="about-hero-text">
              <p className="about-label">About us</p>
              <h1 className="about-title">Make music learning accessible to all</h1>
              <p className="about-description">
                We build tools that helps musicians, educators, and creators learn faster, 
                practice smarter, and unlock creative ideas.
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
                Our story began with a simple idea: understanding music should be as natural as listening to it. 
                Today we build AI-powered tools that help musicians, students, and creators turn any recording 
                into something they can study, perform, and share.
              </p>
            </div>
          </section>

          {/* Our Values Section */}
          <section className="about-values">
            <div className="about-values-header">
              <p className="about-label">Our values</p>
              <p className="about-values-subtitle">
                We believe in forging strong relationships with our customers, partners, and employees, 
                based on trust and mutual respect.
              </p>
            </div>
            
            <div className="values-grid">
              <div className="value-card">
                <div className="value-icon">
                  <PhosphorIcons.Circuitry size={56} weight="regular" />
                </div>
                <h3 className="value-title">Innovation</h3>
                <p className="value-description">
                  We are committed to continuous innovation, providing cutting-edge solutions 
                  that drive success
                </p>
              </div>
              
              <div className="value-card">
                <div className="value-icon">
                  <PhosphorIcons.Handshake size={56} weight="regular" />
                </div>
                <h3 className="value-title">Collaboration</h3>
                <p className="value-description">
                  We believe in the power of collaboration, working closely with our users 
                  to understand their unique needs
                </p>
              </div>
              
              <div className="value-card">
                <div className="value-icon">
                  <PhosphorIcons.ShieldCheck size={56} weight="regular" />
                </div>
                <h3 className="value-title">Integrity</h3>
                <p className="value-description">
                  We uphold the highest standards of integrity in all our actions, 
                  ensuring honesty and transparency
                </p>
              </div>
              
              <div className="value-card">
                <div className="value-icon">
                  <PhosphorIcons.Target size={56} weight="regular" />
                </div>
                <h3 className="value-title">Excellence</h3>
                <p className="value-description">
                  We strive for excellence in everything we do, delivering top-quality 
                  services consistently
                </p>
              </div>
            </div>
          </section>

          {/* Partner With Us Section */}
          <section className="about-partner">
            <div className="partner-text">
              <p className="about-label">Partner with us</p>
              <p className="partner-description">
                If you need results, GrooveSheet is here to give you that edge by cutting time 
                and reducing costs. Let us help you take the first step.
              </p>
            </div>
            
            <div className="partner-form">
              <form onSubmit={handleSubmit}>
                <input 
                  type="text" 
                  name="name"
                  placeholder="Name" 
                  className="form-input"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
                
                <input 
                  type="email" 
                  name="email"
                  placeholder="Company Email" 
                  className="form-input"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                
                <textarea 
                  name="message"
                  placeholder="Message (Optional)" 
                  className="form-textarea"
                  value={formData.message}
                  onChange={handleInputChange}
                ></textarea>
                
                <div className="form-checkbox">
                  <div 
                    className={`checkbox-wrapper ${consent ? 'checked' : ''}`}
                    onClick={() => setConsent(!consent)}
                  >
                    {consent && <PhosphorIcons.Check size={21} weight="regular" />}
                  </div>
                  <p className="checkbox-label">
                    By submitting your data in the contact form, you agree that GrooveSheet 
                    can use this information to get in touch with you and provide the details you requested.
                  </p>
                </div>
                
                {submitStatus === 'success' && (
                  <div className="form-message success">
                    Thank you! Your message has been sent successfully.
                  </div>
                )}
                
                {submitStatus === 'error' && (
                  <div className="form-message error">
                    Sorry, there was an error submitting your form. Please try again.
                  </div>
                )}
                
                <button 
                  type="submit" 
                  className="form-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Confirm'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

export default About;
