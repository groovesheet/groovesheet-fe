import { setRequestLocale } from 'next-intl/server';
import TranscriptionDetail from '../../account/_components/TranscriptionDetail';
import { accountMetadata } from '../../account/_components/accountMetadata';

interface Props {
  params: Promise<{ locale: string; workflowId: string }>;
}

// The song's name is only readable with the owner's token, so the server
// title is generic; the page sets the real one once it has loaded.
export async function generateMetadata({ params }: Props) {
  const { locale, workflowId } = await params;
  return accountMetadata('Transcription', `/transcription-history/${encodeURIComponent(workflowId)}`, locale);
}

export default async function TranscriptionDetailPage({ params }: Props) {
  const { locale, workflowId } = await params;
  setRequestLocale(locale);
  return <TranscriptionDetail workflowId={workflowId} />;
}
