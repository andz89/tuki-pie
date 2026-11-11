import { describe, expect, it, vi } from 'vitest';
import { CARD_WIDTH, cardBounds } from './reminder-window';

vi.mock('electron', () => ({ BrowserWindow: vi.fn(), screen: {} }));

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

describe('cardBounds', () => {
  it('sits at the top right with a gap', () => {
    expect(cardBounds(WORK_AREA, 150)).toEqual({
      x: 1920 - CARD_WIDTH - 16,
      y: 16,
      width: CARD_WIDTH,
      height: 150,
    });
  });

  it('follows a second screen placed to the left', () => {
    expect(cardBounds({ ...WORK_AREA, x: -1920 }, 150).x).toBe(
      -CARD_WIDTH - 16,
    );
  });

  it('keeps the height between a minimum and the screen', () => {
    expect(cardBounds(WORK_AREA, 10).height).toBe(80);
    expect(cardBounds(WORK_AREA, 5000).height).toBe(1040 - 32);
  });
});
