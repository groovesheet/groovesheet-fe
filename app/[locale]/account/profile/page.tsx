import { setRequestLocale } from 'next-intl/server';
import AccountProfile from '../_components/AccountProfile';
import { accountMetadata } from '../_components/accountMetadata';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return accountMetadata('Profile & Settings', '/account/profile', locale, 'Manage your GrooveSheet identity, public creator page, and preferences.');
}

export default async function AccountProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountProfile />;
}
