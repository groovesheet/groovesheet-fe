import { describe, expect, it } from 'vitest';
import { failureMessage, isNoInstrumentMessage } from '@/app/[locale]/(marketing)/_components/upload/shared';

// Verbatim from midi2score-worker/shared/stem_guard.py no_content_message().
const GENERIC =
  "We couldn't find the instrument you picked in this track — the separated stem is effectively silent, so there was nothing to transcribe. Try a recording that features it, or pick a different instrument.";
const NAMED =
  "We couldn't find any piano in this track. The separated piano stem is effectively silent, so there was nothing to transcribe — try a recording that features piano, or pick a different instrument.";

describe('isNoInstrumentMessage', () => {
  it('recognizes both worker messages', () => {
    expect(isNoInstrumentMessage(GENERIC)).toBe(true);
    expect(isNoInstrumentMessage(NAMED)).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isNoInstrumentMessage('Processing failed.')).toBe(false);
    expect(isNoInstrumentMessage(null)).toBe(false);
  });
});

describe('failureMessage', () => {
  it('reads the preview endpoint field (error) as well as message', () => {
    expect(failureMessage({ error: NAMED })).toBe(NAMED);
    expect(failureMessage({ message: 'Out of memory', error: NAMED })).toBe('Out of memory');
    expect(failureMessage({ message: '  ', error: null })).toBeNull();
  });
});
