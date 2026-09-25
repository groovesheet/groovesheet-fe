/**
 * The company's own details, in one place.
 *
 * These are citation data: the legal pages show them, and every directory
 * profile (Crunchbase, Product Hunt, a Google Business Profile) repeats them.
 * Search engines treat a consistent name, address and phone across those
 * citations as evidence that one organization is behind them, so a second
 * copy that drifts is not a typo, it is a weaker brand entity.
 *
 * Both fields below had drifted, in different ways:
 *
 *  - The phone. /help offered one number while /business-information and
 *    /terms printed another, retired in September 2026, so the site published
 *    two on its own legal pages.
 *  - The legal name. The pages said "USEFOOL TECHNOLOGY PRIVATE LIMITED",
 *    which was wrong twice over. Business registration 77709205 was
 *    incorporated on 17 February 2025 as USEFOOL TECHNOLOGY LIMITED, never
 *    "Private Limited" (that is a Singapore and India form, not a Hong Kong
 *    one), and it was renamed to Kelin Studio Limited on 20 August 2026.
 *    The pages had been naming a company that no longer existed under that
 *    name, in a form it never had.
 *
 * GrooveSheet is the product and the brand; Kelin Studio Limited is the
 * company that operates it. Keep that distinction when filling in a directory
 * profile: the organization people search for is GrooveSheet, and this is the
 * legal name that belongs in the profile's legal-name field.
 */
export const COMPANY = {
  /** Registered name as of 20 August 2026. See `formerLegalName`. */
  legalName: 'Kelin Studio Limited',
  /** The name on the incorporation record, kept because older documents use it. */
  formerLegalName: 'USEFOOL TECHNOLOGY LIMITED',
  legalNameChangedOn: '2026-08-20',
  jurisdiction: 'Hong Kong',
  /** "Private company limited by shares" on the Hong Kong register. */
  companyType: 'Private company limited by shares',
  businessRegistrationNo: '77709205',
  incorporatedOn: '2025-02-17',
  establishedYear: 2025,
  registeredAddress: 'Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy, Central, Hong Kong S.A.R.',
  /**
   * The number support answers, on every page that prints one.
   *
   * ASSUMPTION worth one look: it was given as the bare 84106368, and both
   * numbers it replaces were Singapore (+65 8996 8765, +65 8575 5666), so +65
   * is what it is rendered as here. Hong Kong (+852) uses eight digits too. If
   * it is a +852 number, change the two lines below and nothing else.
   */
  phone: '+65 8410 6368',
  phoneHref: 'https://wa.me/6584106368',
  businessEmail: 'business@usefool-ai.com',
  supportEmail: 'support@groovesheet.net',
} as const;
