/**
 * Every profile GrooveSheet actually holds, in one list.
 *
 * Two consumers that used to keep separate copies:
 *
 *   - the footer, which renders them with an icon each
 *   - the Organization JSON-LD's `sameAs`, which is how Google is told that
 *     these accounts and this domain are one entity
 *
 * The schema's copy had drifted to four entries against the footer's sixteen,
 * and one of the four was a guessable-looking handle that is not the real one:
 * X is `@groovesheet_`, with the underscore. `sameAs` is exactly the field
 * where a wrong URL costs something, since it claims an identity, so the list
 * lives here and both sides read it.
 *
 * Add a profile only once it exists and is the canonical one. A `sameAs`
 * pointing at a 404 asserts an identity nobody can confirm.
 */

export interface BrandProfile {
  /** Display name, used as the footer link's accessible label. */
  name: string;
  url: string;
}

export const BRAND_PROFILES: BrandProfile[] = [
  { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61584710236945' },
  { name: 'Instagram', url: 'https://www.instagram.com/groovesheet/' },
  { name: 'X', url: 'https://x.com/groovesheet_' },
  { name: 'YouTube', url: 'https://www.youtube.com/@GrooveSheet_AI' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@groovesheet' },
  { name: 'Reddit', url: 'https://www.reddit.com/user/groovesheet/' },
  { name: 'GitHub', url: 'https://github.com/groovesheet' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/groovesheet/' },
  { name: 'Discord', url: 'https://discord.gg/ptfn6ZYDHV' },
  { name: 'Dev.to', url: 'https://dev.to/groovesheet' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/groovesheet' },
  { name: 'Medium', url: 'https://medium.com/@groovesheet/about' },
  { name: 'Threads', url: 'https://www.threads.com/@groovesheet' },
  { name: 'Tumblr', url: 'https://www.tumblr.com/groovesheet' },
  { name: 'Twitch', url: 'https://www.twitch.tv/groovesheet' },
  { name: 'Pinterest', url: 'https://www.pinterest.com/groovesheet/' },
];

/**
 * `sameAs` for the Organization entity.
 *
 * Invite links are left out: discord.gg/… is a way in, not a profile page
 * that describes the organization, and it can expire, which is the one thing
 * a `sameAs` URL must not do.
 */
export const BRAND_SAME_AS: string[] = BRAND_PROFILES.filter((p) => !p.url.includes('discord.gg')).map((p) => p.url);
