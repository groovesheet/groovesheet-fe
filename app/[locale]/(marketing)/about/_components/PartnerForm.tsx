'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Check } from '@phosphor-icons/react';
import StatusMessage from '@/components/ui/StatusMessage';

type SubmitStatus = 'success' | 'error' | null;

interface PartnerFormData {
  name: string;
  email: string;
  message: string;
}

const EMPTY_FORM: PartnerFormData = { name: '', email: '', message: '' };

/** The "Partner with us" form, posted straight to HubSpot's CORS-friendly endpoint. */
export default function PartnerForm() {
  const [formData, setFormData] = useState<PartnerFormData>(EMPTY_FORM);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!consent) {
      alert('Please agree to the terms before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID;
      const HUBSPOT_FORM_GUID = process.env.NEXT_PUBLIC_HUBSPOT_FORM_GUID;

      // Check if credentials are available
      if (!HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_GUID) {
        console.error('HubSpot credentials not configured');
        setSubmitStatus('error');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: [
              { name: 'firstname', value: formData.name },
              { name: 'email', value: formData.email },
              ...(formData.message ? [{ name: 'message', value: formData.message }] : []),
            ],
            context: {
              pageUri: window.location.href,
              pageName: 'About - Partner Form',
            },
            legalConsentOptions: {
              consent: {
                consentToProcess: true,
                text: 'I agree that GrooveSheet can use this information to get in touch with me and provide the details I requested.',
                communications: [
                  {
                    value: true,
                    subscriptionTypeId: 999,
                    text: 'I agree to receive marketing communications from GrooveSheet.',
                  },
                ],
              },
            },
          }),
        }
      );

      if (response.ok) {
        setSubmitStatus('success');
        setFormData(EMPTY_FORM);
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
          <div className={`checkbox-wrapper ${consent ? 'checked' : ''}`} onClick={() => setConsent(!consent)}>
            {consent && <Check size={21} weight="regular" />}
          </div>
          <p className="checkbox-label">
            By submitting your data in the contact form, you agree that GrooveSheet can use this information to get in
            touch with you and provide the details you requested.
          </p>
        </div>

        {submitStatus === 'success' && (
          <StatusMessage variant="success">Thank you! Your message has been sent successfully.</StatusMessage>
        )}

        {submitStatus === 'error' && (
          <StatusMessage variant="error">Sorry, there was an error submitting your form. Please try again.</StatusMessage>
        )}

        <button type="submit" className="form-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Confirm'}
        </button>
      </form>
    </div>
  );
}
