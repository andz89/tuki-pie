import { describe, expect, it, vi } from 'vitest';
import { Startup } from './startup';

function deps() {
  return { showError: vi.fn(), exit: vi.fn() };
}

describe('Startup', () => {
  it('runs the start without showing anything when it succeeds', () => {
    const startup = new Startup();
    const start = vi.fn();
    const { showError, exit } = deps();
    startup.run(start, { showError, exit });
    expect(start).toHaveBeenCalledOnce();
    expect(showError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('shows the error and exits when the start throws', () => {
    const startup = new Startup();
    const { showError, exit } = deps();
    startup.run(
      () => {
        throw new Error('database disk image is malformed');
      },
      { showError, exit },
    );
    expect(showError).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('database disk image is malformed'),
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('cleans up what was started before the failure, newest first', () => {
    const startup = new Startup();
    const order: string[] = [];
    const showError = vi.fn();
    const exit = vi.fn(() => order.push('exit'));
    startup.run(
      () => {
        startup.onQuit(() => order.push('db'));
        startup.onQuit(() => order.push('bridge'));
        throw new Error('boom');
      },
      { showError, exit },
    );
    expect(order).toEqual(['bridge', 'db', 'exit']);
  });

  it('keeps cleaning up when one cleanup throws, and runs each once', () => {
    const startup = new Startup();
    const db = vi.fn();
    startup.onQuit(db);
    startup.onQuit(() => {
      throw new Error('already stopped');
    });
    startup.cleanUp();
    startup.cleanUp();
    expect(db).toHaveBeenCalledOnce();
  });
});
