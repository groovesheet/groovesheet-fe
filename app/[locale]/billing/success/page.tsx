import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import BillingSuccess from '../../account/_components/BillingSuccess';
import { accountMetadata } from '../../account/_components/accountMetadata';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return accountMetadata('Payment complete', '/billing/success', locale);
}

// BillingSuccess reads ?session_id with useSearchParams, which needs a
// Suspense boundary for this route to stay static.
export default async function BillingSuccessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <BillingSuccess />
    </Suspense>
  );
}
