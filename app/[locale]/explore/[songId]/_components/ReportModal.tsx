'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { reportTrack } from '@/lib/libraryApi';

const field: CSSProperties = {
  width: '100%',
  background: 'var(--color-input-bg)',
  border: '1px solid var(--color-input-border)',
  borderRadius: 8,
  padding: '10px 13px',
  fontFamily: 'var(--font-family-sans)',
  fontSize: 14,
  color: 'var(--color-text)',
  outline: 'none',
};
const label: CSSProperties = { fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 6, display: 'block' };

/** Report dialog, portalled to <body> (LoginModal pattern). The launch DMCA path. */
export default function ReportModal({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const [reason, setReason] = useState('copyright');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reportTrack(trackId, {
        reason,
        details: details.trim() || undefined,
        contact: contact.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Could not send the report');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,.6)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Report this track"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--color-panel1)',
          borderRadius: 13,
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--color-text)' }}>Report This Track</div>
        {done ? (
          <>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--color-muted-foreground)' }}>
              Thanks, your report was received and this track has been flagged for review. For formal DMCA notices,
              email{' '}
              <a href="mailto:support@groovesheet.net" style={{ color: 'var(--color-primary)' }}>
                support@groovesheet.net
              </a>
              .
            </p>
            <button type="button" className="gs-btn gs-btn-primary" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            {error && <p style={{ margin: 0, fontSize: 13, color: '#FF6B7A' }}>{error}</p>}
            <div>
              <label htmlFor="report-reason" style={label}>
                Reason
              </label>
              <select
                id="report-reason"
                style={{ ...field, cursor: 'pointer' }}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="copyright">Copyright infringement</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-details" style={label}>
                Details (optional)
              </label>
              <textarea
                id="report-details"
                style={{ ...field, height: 84, resize: 'vertical' }}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                placeholder="What's the issue? For copyright claims, tell us who owns the work."
              />
            </div>
            <div>
              <label htmlFor="report-contact" style={label}>
                Contact email (optional, for follow-up)
              </label>
              <input
                id="report-contact"
                type="email"
                style={field}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="gs-btn gs-btn-secondary"
                style={{ flex: 1 }}
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="gs-btn gs-btn-primary" style={{ flex: 1 }} disabled={busy}>
                {busy ? 'Sending…' : 'Send Report'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>,
    document.body
  );
}
