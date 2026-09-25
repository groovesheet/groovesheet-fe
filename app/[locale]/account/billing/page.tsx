import { setRequestLocale } from 'next-intl/server';
import AccountBilling from '../_components/AccountBilling';
import { accountMetadata } from '../_components/accountMetadata';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return accountMetadata('Billing & Usage', '/account/billing', locale, 'Manage your GrooveSheet plan, track minutes, and review your usage history.');
}

export default async function AccountBillingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountBilling />;
}
