/**
 * "Did you mean ...@kakao.com?" for the email sign-in box.
 *
 * On 2026-10-07 a visitor who had just picked Pro annual typed
 * `...@kakacomc.com` (meant kakao.com), waited for a code that could never
 * arrive, and left. A typo in the domain is silent: the code goes out, nothing
 * bounces back to the page, and the visitor just sees no email. This catches
 * the common slips against the providers our visitors actually use (Chinese,
 * Korean and Western webmail) and offers the fix; the visitor can keep what
 * they typed. Domains that cannot receive mail at all are caught separately
 * by the /email-domain DNS check.
 */

// Ordered by how often our visitors use them, so a tie goes to the likelier one.
export const KNOWN_EMAIL_DOMAINS = [
  'gmail.com',
  'qq.com',
  '163.com',
  '126.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'naver.com',
  'kakao.com',
  'daum.net',
  'hanmail.net',
  'nate.com',
  'foxmail.com',
  'sina.com',
  'sina.cn',
  'sohu.com',
  'aliyun.com',
  '139.com',
  'yeah.net',
  'live.com',
  'msn.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'googlemail.com',
  'ymail.com',
  'gmx.de',
  'gmx.com',
  'gmx.net',
  'web.de',
  'yandex.ru',
  'mail.ru',
  'yahoo.co.jp',
  'yahoo.co.uk',
  'yahoo.com.tw',
  'yahoo.com.hk',
  'hotmail.co.uk',
  'hotmail.fr',
  'outlook.jp',
  'orange.fr',
  'free.fr',
  'libero.it',
  'comcast.net',
  'att.net',
  'verizon.net',
  'zoho.com',
  'fastmail.com',
  'hey.com',
];

const KNOWN = new Set(KNOWN_EMAIL_DOMAINS);

// Endings that are almost always a slip for ".com" (".cm" is Cameroon and
// ".co" Colombia, so these only count when the rest is a known provider).
const COM_SLIPS = new Set(['con', 'cmo', 'cm', 'om', 'comm', 'coom', 'ccom', 'co', 'ocm', 'vom', 'xom', 'cpm', 'cim', 'c0m', 'c']);

/** Edit distance where swapping two neighbouring letters counts as one edit. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function labelOf(domain: string): string {
  return domain.split('.')[0];
}

/**
 * The domain the visitor most likely meant, or null when what they typed is
 * fine (a known provider, or nothing close to one).
 */
export function suggestEmailDomain(domainInput: string): string | null {
  const domain = domainInput.trim().toLowerCase().replace(/\.+$/, '');
  if (!domain || KNOWN.has(domain)) return null;

  const dot = domain.indexOf('.');
  const label = dot === -1 ? domain : domain.slice(0, dot);
  const rest = dot === -1 ? '' : domain.slice(dot + 1);

  // gmail.con, qq.cmo, naver.co, kakao (no ending at all).
  if (rest === '' || COM_SLIPS.has(rest)) {
    const sameLabel = KNOWN_EMAIL_DOMAINS.find((k) => labelOf(k) === label && k.endsWith('.com'));
    if (sameLabel) return sameLabel;
  }
  // gmailcom.com / gmail.com.com: ".com" typed twice.
  if (domain.endsWith('.com.com') && KNOWN.has(domain.slice(0, -4))) return domain.slice(0, -4);
  if (label.endsWith('com') && rest === 'com' && KNOWN.has(`${label.slice(0, -3)}.com`)) return `${label.slice(0, -3)}.com`;

  // A provider's own country site (hotmail.it, outlook.de, live.cn) is real.
  if (KNOWN_EMAIL_DOMAINS.some((k) => labelOf(k) === label)) return null;

  // Fuzzy match on the whole domain, and on the label with a stray "com"
  // taken out (kakacomc.com -> kakac -> kakao.com). Short labels (qq, 163,
  // me, mi) sit too close to real, different domains to guess at.
  const labels = new Set([label]);
  if (label.includes('com')) labels.add(label.replace(/com/g, ''));

  let best: { domain: string; score: number } | null = null;
  for (const known of KNOWN_EMAIL_DOMAINS) {
    const knownLabel = labelOf(known);
    if (knownLabel.length < 4) continue;
    const allowed = known.length <= 9 ? 1 : 2;
    const scores = [editDistance(domain, known)];
    for (const l of labels) {
      if (l && l !== label) scores.push(editDistance(l, knownLabel) + (rest === known.slice(knownLabel.length + 1) ? 0 : 1));
    }
    const score = Math.min(...scores);
    if (score <= allowed && (!best || score < best.score)) best = { domain: known, score };
  }
  return best?.domain ?? null;
}

/** The whole address with the suggested domain, or null. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const fixed = suggestEmailDomain(email.slice(at + 1));
  return fixed ? `${email.slice(0, at).trim()}@${fixed}` : null;
}
