import { setRequestLocale } from 'next-intl/server';
import TranscriptionHistory from '../_components/TranscriptionHistory';
import { accountMetadata } from '../_components/accountMetadata';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return accountMetadata('Your Library', '/account/history', locale, 'Your transcriptions, stems and MIDI conversions on GrooveSheet.');
}

// proxy.ts has already turned signed-out visitors away; the list itself is
// per-user, so it loads in the browser with the visitor's token.
export default async function AccountHistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TranscriptionHistory />;
}
