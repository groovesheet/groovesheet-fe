/**
 * /u/:username, a creator's public profile. Tier B: server-rendered with ISR,
 * so the name, bio and published songs (as links) are in the HTML for every
 * crawler and share bot, without the vercel.json user-agent rewrite.
 *
 * The server only ever fetches the anonymous view (lib/api-server
 * getCreatorProfile: public songs, is_owner and is_following false). Owner and
 * follower state is resolved in the browser by CreatorProfile (brief 5.9).
 */
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCreatorProfile } from '@/lib/api-server';
import { normalizeHandle } from '@/lib/creatorApi';
import { pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { buildLocalePath } from '@/lib/locales';
import type { CreatorProfile as CreatorProfileData } from '@/lib/types';
import JsonLd from '../../explore/_components/JsonLd';
import CreatorProfile from './_components/CreatorProfile';

export const revalidate = 300;
export const dynamicParams = true;

// Profiles are generated on first request and cached; none at build time.
export function generateStaticParams(): { username: string }[] {
  return [];
}

interface CreatorPageProps {
  params: Promise<{ locale: string; username: string }>;
}

/** The route segment arrives percent-encoded; a malformed one is simply not a creator. */
function handleFromSegment(segment: string): string {
  try {
    return normalizeHandle(decodeURIComponent(segment));
  } catch {
    return '';
  }
}

// generateMetadata and the page share one lookup per render.
const loadProfile = cache(async (segment: string): Promise<CreatorProfileData | null> => {
  const handle = handleFromSegment(segment);
  return handle ? getCreatorProfile(handle) : null;
});

const profilePath = (profile: CreatorProfileData) => `/u/${encodeURIComponent(profile.username)}`;

function profileDescription(profile: CreatorProfileData): string {
  if (profile.bio) return profile.bio;
  const count = profile.songs.length;
  const songs = count === 1 ? '1 transcription' : `${count} transcriptions`;
  return `${profile.display_name} (@${profile.username}) on GrooveSheet: ${songs} with sheet music, MIDI and isolated stems.`;
}

export async function generateMetadata({ params }: CreatorPageProps) {
  const { locale, username } = await params;
  const profile = await loadProfile(username);
  if (!profile) {
    return { title: 'Creator not found', robots: { index: false, follow: false } };
  }
  return pageMetadata({
    title: `${profile.display_name} (@${profile.username}): Transcriptions`,
    description: profileDescription(profile),
    path: profilePath(profile),
    locale,
    // A creator link should unfurl as that creator, not the site logo.
    image: profile.avatar_url,
    ogType: 'profile',
  });
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { locale, username } = await params;
  setRequestLocale(locale);

  // Null only on a 404; other API failures throw, so an outage is not cached
  // as "no such creator".
  const profile = await loadProfile(username);
  if (!profile) notFound();

  const url = `${SITE_URL}${buildLocalePath(locale, profilePath(profile))}`;
  const links = Object.values(profile.links).filter((v): v is string => typeof v === 'string' && Boolean(v));

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url,
          mainEntity: {
            '@type': 'Person',
            name: profile.display_name,
            alternateName: `@${profile.username}`,
            ...(profile.bio ? { description: profile.bio } : {}),
            ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
            ...(links.length ? { sameAs: links } : {}),
          },
          hasPart: profile.songs.slice(0, 30).map((s) => ({
            '@type': 'MusicComposition',
            name: s.title,
            url: `${SITE_URL}${buildLocalePath(locale, `/explore/${encodeURIComponent(s.id)}`)}`,
          })),
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: SITE_NAME, path: '/' },
          { name: 'Explore', path: '/explore' },
          { name: profile.display_name, path: profilePath(profile) },
        ])}
      />
      <CreatorProfile key={profile.username} initialProfile={profile} />
    </>
  );
}
