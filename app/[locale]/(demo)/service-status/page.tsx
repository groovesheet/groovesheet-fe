import { setRequestLocale } from 'next-intl/server';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';
import ServiceStatus from '../_components/ServiceStatus';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(
    props,
    '/service-status',
    'Service Status',
    'Live status of the GrooveSheet transcription, stem separation and score services.'
  );
}

// The figures are live (polled every 15s in the browser), so the server HTML
// is only the page frame and its loading skeleton.
export default async function ServiceStatusRoute({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServiceStatus />;
}
