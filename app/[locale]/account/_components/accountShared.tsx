/**
 * Client-side pieces the Tier C pages (/account/*, /transcription-history/:id)
 * share. Private to P4.
 */
import { AuthError } from '@/lib/api';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '';
}

export function isAuthError(err: unknown): boolean {
  return err instanceof AuthError;
}

/** Hand a Blob to the browser as a file download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Canonical GrooveSheet button styles, scoped via a single <style> injection so
// all the account pages can share the .gs-btn variants from the design.
export const BillingButtonStyles = () => (
  <style>{`
    .back-button{display:inline-flex;align-items:center;gap:8px;background:none;border:none;color:var(--color-text);cursor:pointer;padding:0;font-family:var(--font-family-sans);font-size:18px;transition:opacity .2s ease;}
    .back-button:hover{opacity:.7;}
    .gs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 20px;border:1px solid transparent;border-radius:8px;font-family:var(--font-family-sans);font-size:14px;font-weight:500;line-height:1;cursor:pointer;white-space:nowrap;text-decoration:none;transition:background-color .2s ease,color .2s ease,border-color .2s ease;}
    .gs-btn-primary{background:var(--color-primary);color:#fff;}
    .gs-btn-primary:hover{background:#0139c7;}
    .gs-btn-secondary{background:transparent;color:var(--color-text);border-color:var(--color-border);}
    .gs-btn-secondary:hover{border-color:var(--color-primary);color:var(--color-primary);}
    .gs-btn-ghost{background:transparent;color:var(--color-muted-foreground);}
    .gs-btn-ghost:hover{color:var(--color-text);background:var(--color-surface-lightest);}
    .gs-btn-destructive{background:#e5484d;color:#fff;}
    .gs-btn-destructive:hover{background:#cf3b40;}
    .gs-btn-destructive-outline{background:transparent;color:var(--color-danger);border-color:color-mix(in srgb,var(--color-danger) 45%,transparent);}
    .gs-btn-destructive-outline:hover{background:var(--color-danger);color:#fff;}
    .gs-btn:disabled,.gs-btn[disabled]{background:var(--color-border);color:var(--color-muted-foreground);border-color:transparent;cursor:not-allowed;}
    .gs-btn-full{width:100%;}
    .gs-btn:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px;}
  `}</style>
);
