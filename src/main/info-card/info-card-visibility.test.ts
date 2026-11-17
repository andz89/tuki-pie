import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrontApp } from './front-app';
import { InfoCardVisibility, LOOK_MS } from './info-card-visibility';

let front: FrontApp;
let show: ReturnType<typeof vi.fn<() => void>>;
let hide: ReturnType<typeof vi.fn<() => void>>;
let visibility: InfoCardVisibility;

// Two looks: a change counts once it is seen twice.
const settle = () => vi.advanceTimersByTime(LOOK_MS * 2);

beforeEach(() => {
  vi.useFakeTimers();
  front = 'chrome';
  show = vi.fn<() => void>();
  hide = vi.fn<() => void>();
  visibility = new InfoCardVisibility({ frontApp: () => front, show, hide });
  visibility.start();
});

afterEach(() => {
  visibility.stop();
  vi.useRealTimers();
});

describe('showing the card only with Chrome', () => {
  it('hides when another app comes in front, and shows with Chrome', () => {
    front = 'other';
    settle();
    expect(hide).toHaveBeenCalled();
    front = 'chrome';
    settle();
    expect(show).toHaveBeenCalled();
  });

  it('stays as it is while Pie Launcher is in front', () => {
    front = 'own';
    settle();
    expect(hide).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('does not blink for a moment of another app', () => {
    front = 'other';
    vi.advanceTimersByTime(LOOK_MS);
    front = 'chrome';
    vi.advanceTimersByTime(LOOK_MS);
    expect(hide).not.toHaveBeenCalled();
  });

  it('never hides when Windows cannot say', () => {
    front = null;
    settle();
    expect(hide).not.toHaveBeenCalled();
  });

  it('does nothing after the card closes', () => {
    visibility.stop();
    front = 'other';
    settle();
    expect(hide).not.toHaveBeenCalled();
  });
});
