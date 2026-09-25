import { setRequestLocale } from 'next-intl/server';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';
import PreviewDemo from '../_components/PreviewDemo';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(
    props,
    '/preview1',
    'Preview Player Demo',
    'The preview player in demo mode: sheet music, piano roll and 3D piano on a Beethoven sample.'
  );
}

export default async function Preview1Route({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PreviewDemo />;
}
