/**
 * Ported from src/player/transport.test.js. Targets P1's verbatim port of
 * src/player/transport.js somewhere under components/player/.
 */
import { onlyModule } from '../onlyModule';

interface Engine {
  id: string;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  readTime: () => number;
}

interface Transport {
  attachEngine: (engine: Engine) => void;
  setDuration: (seconds: number) => void;
  setActiveEngine: (id: string) => void;
  seek: (seconds: number) => void;
  play: () => void;
  getPosition: () => number;
}

interface TransportModule {
  createTransport: () => Transport;
}

const { createTransport } = onlyModule(
  import.meta.glob<TransportModule>('/components/player/**/transport.{ts,tsx,js,jsx}', { eager: true }),
  'components/player/**/transport'
);

describe('shared playback transport', () => {
  let nextFrame: FrameRequestCallback | null;
  let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame;

  const runFrame = () => {
    if (!nextFrame) throw new Error('transport did not schedule a frame');
    nextFrame(0);
  };

  beforeEach(() => {
    nextFrame = null;
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => {
      nextFrame = callback;
      return 1;
    };
    globalThis.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('does not rewind when an active engine briefly reports zero', () => {
    const readTime = vi.fn<() => number>()
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(0);
    const transport = createTransport();
    transport.attachEngine({
      id: 'score',
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      readTime,
    });
    transport.setDuration(180);
    transport.setActiveEngine('score');
    transport.seek(12);
    transport.play();

    runFrame();
    expect(transport.getPosition()).toBe(12);
    runFrame();
    expect(transport.getPosition()).toBeGreaterThanOrEqual(11.75);
  });
});
