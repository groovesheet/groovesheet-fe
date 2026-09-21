import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/lib/navigation';
import { accountMetadata } from '../account/_components/accountMetadata';

interface Props {
  params: Promise<{ locale: string }>;
}

// Never rendered (the page redirects), but a crawler following an old link
// still gets a noindex answer rather than the site default.
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return accountMetadata('History', '/history', locale);
}

// Old path, kept so bookmarks and emails still land. Was <Navigate replace>.
export default async function Redirect({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: '/account/history', locale });
}
