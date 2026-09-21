import type { CSSProperties, ReactNode } from 'react';
import './StatusMessage.css';

export type StatusVariant = 'error' | 'warning' | 'info' | 'success';

export interface StatusMessageProps {
  variant?: StatusVariant;
  /** Bold accent-colored heading. Omit for a single-line message. */
  title?: ReactNode;
  /** Detail text, or the whole message when there is no title. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const ICONS: Record<StatusVariant, ReactNode> = {
  error: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  warning: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

/**
 * Site-wide inline status banner for error, warning, info and success
 * messages, matching the design-system "Toast & banner" spec.
 *
 *   <StatusMessage variant="error" title="Couldn't load history">{msg}</StatusMessage>
 *   <StatusMessage variant="error">File too large. Max 32 MB.</StatusMessage>
 */
export function StatusMessage({
  variant = 'error',
  title,
  children,
  className = '',
  style,
}: StatusMessageProps) {
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  return (
    <div
      className={`gs-statusmsg gs-statusmsg--${variant} ${title ? '' : 'gs-statusmsg--bare'} ${className}`.trim()}
      role={role}
      style={style}
    >
      <svg
        className="gs-statusmsg__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        {ICONS[variant] ?? ICONS.error}
      </svg>
      <div className="gs-statusmsg__body">
        {title ? (
          <>
            <strong className="gs-statusmsg__title">{title}</strong>
            {children != null && <p className="gs-statusmsg__detail">{children}</p>}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default StatusMessage;
