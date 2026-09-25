/**
 * The company's own details, in one place.
 *
 * These are citation data: the legal pages show them, and every directory
 * profile (Crunchbase, Product Hunt, a Google Business Profile) repeats them.
 * Search engines treat a consistent name, address and phone across those
 * citations as evidence that one organization is behind them, so a second
 * copy that drifts is not a typo, it is a weaker brand entity.
 *
 * It had already drifted. /help offered +65 8996 8765 while
 * /business-information and /terms printed +65 8575 5666, a number retired in
 * September 2026, so the site published two different phone numbers on its
 * own legal pages.
 *
 * NOTE on the legal name: the pages say "USEFOOL TECHNOLOGY PRIVATE LIMITED",
 * while the Hong Kong company registry lists business registration 77709205
 * as "USEFOOL TECHNOLOGY LIMITED" ("Private Limited" is a Singapore and India
 * form, not a Hong Kong one). That is a question for the registration
 * certificate rather than for this file, so the string below is left exactly
 * as the pages have always had it. Correct it here once, when you know.
 */
export const COMPANY = {
  /** As printed on the legal pages. See the note above before changing. */
  legalName: 'USEFOOL TECHNOLOGY PRIVATE LIMITED',
  jurisdiction: 'Hong Kong',
  businessRegistrationNo: '77709205',
  establishedYear: 2025,
  registeredAddress: 'Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy, Central, Hong Kong S.A.R.',
  /** The number support actually answers; also the one /help shows. */
  phone: '+65 8996 8765',
  phoneHref: 'https://wa.me/6589968765',
  businessEmail: 'business@usefool-ai.com',
  supportEmail: 'support@groovesheet.net',
} as const;
