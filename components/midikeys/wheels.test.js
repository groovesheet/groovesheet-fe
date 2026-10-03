import { bendAmount } from './wheels';

test('the pitch wheel at rest is no bend, and both ends reach a full bend', () => {
  expect(bendAmount(0x00, 0x40)).toBe(0); // 8192
  expect(bendAmount(0x7f, 0x7f)).toBe(1); // 16383
  expect(bendAmount(0x00, 0x00)).toBe(-1); // 0
  expect(bendAmount(0x00, 0x60)).toBeCloseTo(0.5, 3); // 12288
});
