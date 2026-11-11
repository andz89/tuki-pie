import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBeforeClose } from './save-before-close';

type Handler = (event: { preventDefault: () => void }) => void;

function fakeWindow() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    on: (name: string, handler: Handler) => handlers.set(name, handler),
    destroy: vi.fn(),
    isDestroyed: () => false,
  };
}

function close(window: ReturnType<typeof fakeWindow>) {
  const event = { preventDefault: vi.fn() };
  window.handlers.get('close')?.(event);
  return event;
}

let quitting: boolean;
const quit = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  quitting = false;
  quit.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function guard(
  window: ReturnType<typeof fakeWindow>,
  save: () => Promise<void>,
) {
  saveBeforeClose(window, save, {
    timeoutMs: 2000,
    isQuitting: () => quitting,
    quit,
  });
}

describe('saveBeforeClose', () => {
  it('holds the close until the page says its text is saved', async () => {
    const window = fakeWindow();
    let saved: () => void = () => undefined;
    guard(window, () => new Promise((resolve) => (saved = resolve)));

    expect(close(window).preventDefault).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(100);
    expect(window.destroy).not.toHaveBeenCalled();

    saved();
    await vi.advanceTimersByTimeAsync(0);
    expect(window.destroy).toHaveBeenCalledOnce();
  });

  it('closes anyway when the page does not answer in time', async () => {
    const window = fakeWindow();
    guard(window, () => new Promise(() => undefined));
    close(window);
    await vi.advanceTimersByTimeAsync(2000);
    expect(window.destroy).toHaveBeenCalledOnce();
  });

  it('closes anyway when saving fails', async () => {
    const window = fakeWindow();
    guard(window, () => Promise.reject(new Error('gone')));
    close(window);
    await vi.advanceTimersByTimeAsync(0);
    expect(window.destroy).toHaveBeenCalledOnce();
  });

  it('asks once when the X is clicked twice', async () => {
    const window = fakeWindow();
    const save = vi.fn(() => new Promise<void>(() => undefined));
    guard(window, save);
    close(window);
    close(window);
    expect(save).toHaveBeenCalledOnce();
  });

  it('carries on quitting once saved, as the held close stopped the quit', async () => {
    const window = fakeWindow();
    guard(window, async () => undefined);
    quitting = true;
    close(window);
    await vi.advanceTimersByTimeAsync(0);
    expect(window.destroy).toHaveBeenCalledOnce();
    expect(quit).toHaveBeenCalledOnce();
  });

  it('does not quit after a plain close', async () => {
    const window = fakeWindow();
    guard(window, async () => undefined);
    close(window);
    await vi.advanceTimersByTimeAsync(0);
    expect(quit).not.toHaveBeenCalled();
  });
});
