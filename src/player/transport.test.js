import { createTransport } from './transport';


describe('shared playback transport', () => {
  let nextFrame;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    nextFrame = null;
    originalRequestAnimationFrame = global.requestAnimationFrame;
    originalCancelAnimationFrame = global.cancelAnimationFrame;
    global.requestAnimationFrame = (callback) => {
      nextFrame = callback;
      return 1;
    };
    global.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('does not rewind when an active engine briefly reports zero', () => {
    const readTime = jest.fn().mockReturnValueOnce(12).mockReturnValueOnce(0);
    const transport = createTransport();
    transport.attachEngine({
      id: 'score',
      play: jest.fn(),
      pause: jest.fn(),
      seek: jest.fn(),
      readTime,
    });
    transport.setDuration(180);
    transport.setActiveEngine('score');
    transport.seek(12);
    transport.play();
    nextFrame();
    expect(transport.getPosition()).toBe(12);
    nextFrame();
    expect(transport.getPosition()).toBeGreaterThanOrEqual(11.75);
  });
});
