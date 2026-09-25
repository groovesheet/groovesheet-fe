'use client';

import type { ComponentType } from 'react';
import { clientOnly } from '@/components/ClientOnly';
import SkeletonPanel from '@/components/ui/SkeletonPanel';
import type { DownloadedFile } from '@/lib/types';

/**
 * The finished-job viewer the upload cards expand into (score, piano roll and
 * stems on one transport). It is the player subsystem's component, which uses
 * Web Audio, canvas and OSMD, so it only ever loads in the browser.
 */
export interface ResultViewProps {
  workflowId: string | null;
  fileName?: string | null;
  selectedInstrument: string;
  /** Downloaded blobs by output key. Its identity must stay stable: the viewer reloads when it changes. */
  prefetchedFiles: Record<string, DownloadedFile> | null;
  /** Output file map from the status payload ({ key: r2path }). */
  files: Record<string, unknown> | null;
  onDownloadTranscription: () => void;
  onDownloadStem: () => void;
  onDownloadMidi?: () => void;
  onDownloadPdf?: () => void;
  onReset: () => void;
  downloadError: string | null;
  isSignedIn: boolean;
  onUpgradeToFull: () => void;
  onSignUpToUnlock: () => void;
  title?: string;
  defaultView?: 'sheet' | 'midi';
  statusLabel?: string;
}

// The player module is plain JS ported verbatim, so TypeScript infers every
// destructured prop as required. This interface is the typed surface the
// upload cards use; optional props keep the defaults the component declares.
const TranscriptionResultView = clientOnly<ResultViewProps>(
  () =>
    import('@/components/player/TranscriptionResult/TranscriptionResultView').then((m) => ({
      default: m.default as ComponentType<ResultViewProps>,
    })),
  { fallback: <SkeletonPanel height={420} /> }
);

export default function ResultView(props: ResultViewProps) {
  return <TranscriptionResultView {...props} />;
}
