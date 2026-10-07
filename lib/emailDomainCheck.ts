import { KNOWN_EMAIL_DOMAINS } from '@/lib/emailTypo';

/**
 * Asks /email-domain whether a domain can receive the sign-in code. Anything
 * short of a definite "no" (slow answer, network error, odd response) counts
 * as deliverable: this check must never be the reason a real sign-in fails.
 */

const KNOWN = new Set(KNOWN_EMAIL_DOMAINS);
const TIMEOUT_MS = 2500;
const answers = new Map<string, boolean>();

export async function emailDomainDeliverable(domainInput: string): Promise<boolean> {
  const domain = domainInput.trim().toLowerCase();
  if (KNOWN.has(domain)) return true;
  const cached = answers.get(domain);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`/email-domain?d=${encodeURIComponent(domain)}`, { signal: controller.signal });
    if (!res.ok) return true;
    const body = (await res.json()) as { deliverable?: unknown };
    const deliverable = body.deliverable !== false;
    answers.set(domain, deliverable);
    return deliverable;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}
