import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoverIntent } from './hover-intent';

const fire = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fire.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createHoverIntent', () => {
  it('fires after the delay', () => {
    const intent = createHoverIntent(180, fire);
    intent.enter('g');
    vi.advanceTimersByTime(179);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledExactlyOnceWith('g');
  });

  it('does not fire when the mouse leaves first', () => {
    const intent = createHoverIntent(180, fire);
    intent.enter('g');
    vi.advanceTimersByTime(100);
    intent.leave();
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it('fires only for the last item pointed at', () => {
    const intent = createHoverIntent(180, fire);
    intent.enter('a');
    vi.advanceTimersByTime(100);
    intent.enter('b');
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('ignores the mouse during a pause, so Back cannot bounce into a group', () => {
    const intent = createHoverIntent(180, fire);
    intent.pause(300);
    intent.enter('g');
    vi.advanceTimersByTime(1000);
    expect(fire).not.toHaveBeenCalled();
  });

  it('listens again after a pause', () => {
    const intent = createHoverIntent(180, fire);
    intent.pause(300);
    vi.advanceTimersByTime(300);
    intent.enter('g');
    vi.advanceTimersByTime(180);
    expect(fire).toHaveBeenCalledExactlyOnceWith('g');
  });
});
