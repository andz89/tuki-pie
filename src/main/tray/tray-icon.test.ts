import { describe, expect, it } from 'vitest';
import { donutBitmap } from './tray-icon';

const SIZE = 32;

function alphaAt(bitmap: Buffer, x: number, y: number): number {
  return bitmap[(y * SIZE + x) * 4 + 3];
}

describe('donutBitmap', () => {
  const bitmap = donutBitmap(SIZE);

  it('has four bytes per pixel', () => {
    expect(bitmap.length).toBe(SIZE * SIZE * 4);
  });

  it('is see-through in the middle', () => {
    expect(alphaAt(bitmap, SIZE / 2, SIZE / 2)).toBe(0);
  });

  it('is see-through in the corner', () => {
    expect(alphaAt(bitmap, 0, 0)).toBe(0);
  });

  it('is solid on the ring', () => {
    expect(alphaAt(bitmap, SIZE / 2, 5)).toBe(255);
  });
});
