/**
 * /email-domain?d=example.com: can this domain receive email at all?
 *
 * The email sign-in box asks before sending a code. A domain with no mail
 * server (no MX record and no address record either, or no such domain) can
 * never receive the code, and the visitor would otherwise wait for an email
 * that is not coming: on 2026-10-07 a visitor typed `@kakacomc.com`, which is
 * not even registered, and left. Browsers cannot look up MX records, hence
 * this small route.
 *
 * Only a definite "no such domain" / "no records" answer counts as
 * undeliverable. Timeouts and resolver failures answer `deliverable: true`, so
 * a DNS hiccup never blocks a real sign-in.
 *
 * Locale-less on purpose, like /og: proxy.ts and the vercel.json country
 * redirects leave it alone.
 */
import { Resolver } from 'node:dns/promises';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

// A hostname with at least one dot, labels of letters, digits and hyphens.
const DOMAIN_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

// Answers that mean the name has no records, as opposed to a failed lookup.
const NO_RECORDS = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

type Lookup = 'yes' | 'no' | 'unknown';

async function hasRecords(lookup: () => Promise<unknown[]>): Promise<Lookup> {
  try {
    const records = await lookup();
    return records.length > 0 ? 'yes' : 'no';
  } catch (err) {
    const code = (err as { code?: string }).code;
    return code && NO_RECORDS.has(code) ? 'no' : 'unknown';
  }
}

function answer(deliverable: boolean, reason: string, maxAge: number) {
  return NextResponse.json(
    { deliverable, reason },
    { headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}` } }
  );
}

export async function GET(request: NextRequest) {
  const domain = (request.nextUrl.searchParams.get('d') || '').trim().toLowerCase().replace(/\.+$/, '');
  if (!DOMAIN_RE.test(domain)) return answer(false, 'invalid', 3600);

  const resolver = new Resolver({ timeout: 2000, tries: 2 });

  let nullMx = false;
  const mx = await hasRecords(async () => {
    const records = await resolver.resolveMx(domain);
    // A lone "." exchange is a null MX (RFC 7505): the domain takes no mail.
    nullMx = records.length > 0 && records.every((r) => !r.exchange || r.exchange === '.');
    return nullMx ? [] : records;
  });
  if (nullMx) return answer(false, 'no_mail', 600);
  if (mx === 'yes') return answer(true, 'mx', 86400);
  if (mx === 'unknown') return answer(true, 'unknown', 60);

  // No MX: mail still goes to the domain's own address (RFC 5321 5.1).
  const [a, aaaa] = await Promise.all([
    hasRecords(() => resolver.resolve4(domain)),
    hasRecords(() => resolver.resolve6(domain)),
  ]);
  if (a === 'yes' || aaaa === 'yes') return answer(true, 'address', 86400);
  if (a === 'unknown' || aaaa === 'unknown') return answer(true, 'unknown', 60);
  // Short cache: someone may be registering the domain right now.
  return answer(false, 'no_mail', 600);
}
