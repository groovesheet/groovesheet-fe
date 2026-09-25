/**
 * Ported from src/player/syncMap.test.js. Targets P1's verbatim port of
 * src/player/syncMap.js somewhere under components/player/.
 */
import { onlyModule } from '../onlyModule';

interface SheetSecMapper {
  isIdentity: boolean;
  sheetSecToMidiSec: (seconds: number) => number;
}

interface SyncMapModule {
  createSheetSecMapper: (options: {
    pairs: Array<[number, number]>;
    sheetDurationSec: number;
    preferIdentity: boolean;
  }) => SheetSecMapper;
  musicXmlHasVariableTempo: (xml: string) => boolean;
}

const { createSheetSecMapper, musicXmlHasVariableTempo } = onlyModule(
  import.meta.glob<SyncMapModule>('/components/player/**/syncMap.{ts,tsx,js,jsx}', { eager: true }),
  'components/player/**/syncMap'
);

test('detects embedded varying tempo maps and keeps them on identity timing', () => {
  const xml = `<score-partwise><part><measure><sound tempo="93.3"/></measure><measure><sound tempo="64.5"/></measure></part></score-partwise>`;
  expect(musicXmlHasVariableTempo(xml)).toBe(true);
  const mapper = createSheetSecMapper({
    pairs: [[0, 0], [100, 200]],
    sheetDurationSec: 100,
    preferIdentity: true,
  });
  expect(mapper.isIdentity).toBe(true);
  expect(mapper.sheetSecToMidiSec(6.5)).toBe(6.5);
});

test('does not classify a constant-tempo score as a variable tempo map', () => {
  expect(musicXmlHasVariableTempo('<sound tempo="120"/><sound tempo="120"/>')).toBe(false);
});
