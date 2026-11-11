import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPieWindow,
  dismissPieWindow,
  hidePieWindow,
  isPieWindowOpen,
  setPiePin,
  showPieWindowAtCursor,
} from './pie-window';

const fake = vi.hoisted(() => ({
  handlers: new Map<string, () => void>(),
  loadHandlers: new Map<string, () => void>(),
  focused: true,
  visible: true,
  hide: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class {
    webContents = {
      send: fake.send,
      on: (name: string, handler: () => void) =>
        fake.loadHandlers.set(name, handler),
    };
    loadURL = () => undefined;
    hide = () => {
      fake.visible = false;
      fake.hide();
    };
    show = () => {
      fake.visible = true;
    };
    focus = () => undefined;
    isVisible = () => fake.visible;
    isFocused = () => fake.focused;
    setBounds = () => undefined;
    on(name: string, handler: () => void) {
      fake.handlers.set(name, handler);
    }
  },
  screen: {
    getCursorScreenPoint: () => ({ x: 500, y: 500 }),
    getDisplayNearestPoint: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  },
}));

function clickAway() {
  fake.handlers.get('blur')?.();
}

// Long enough for any closing animation to have finished.
function letAnimationFinish() {
  vi.advanceTimersByTime(1000);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');
  createPieWindow();
  setPiePin('pinned');
  setPiePin('unpinned');
  letAnimationFinish();
  fake.focused = true;
  fake.visible = true;
  fake.hide.mockClear();
  fake.send.mockClear();
});

afterEach(() => {
  letAnimationFinish();
  vi.useRealTimers();
});

describe('an unpinned donut', () => {
  it('closes when the person clicks away', () => {
    clickAway();
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
  });

  it('closes on a click that dismisses it', () => {
    dismissPieWindow();
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
  });
});

describe('a pinned donut', () => {
  beforeEach(() => {
    setPiePin('pinned');
    fake.hide.mockClear();
  });

  it('stays open when the person clicks away', () => {
    clickAway();
    letAnimationFinish();
    expect(fake.hide).not.toHaveBeenCalled();
  });

  it('stays open on a click that would dismiss it', () => {
    dismissPieWindow();
    letAnimationFinish();
    expect(fake.hide).not.toHaveBeenCalled();
  });

  it('still closes when asked directly, as Escape does', () => {
    hidePieWindow();
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
  });

  it('closes when unpinned from another window', () => {
    fake.focused = false;
    setPiePin('unpinned');
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
  });

  it('stays until the next click away when unpinned on the donut itself', () => {
    setPiePin('unpinned');
    letAnimationFinish();
    expect(fake.hide).not.toHaveBeenCalled();
    clickAway();
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
  });
});

describe('the closing animation', () => {
  it('tells the screen to animate, and hides only afterwards', () => {
    hidePieWindow();
    expect(fake.send).toHaveBeenCalledExactlyOnceWith(
      'window:phase',
      'closing',
    );
    expect(fake.hide).not.toHaveBeenCalled();
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
  });

  it('hides once when asked to close twice', () => {
    hidePieWindow();
    hidePieWindow();
    letAnimationFinish();
    expect(fake.hide).toHaveBeenCalledOnce();
    expect(fake.send).toHaveBeenCalledOnce();
  });

  it('does nothing when the donut is already hidden', () => {
    fake.visible = false;
    hidePieWindow();
    letAnimationFinish();
    expect(fake.send).not.toHaveBeenCalled();
    expect(fake.hide).not.toHaveBeenCalled();
  });

  it('counts as closed while it plays, so Ctrl + Shift + click can reopen', () => {
    expect(isPieWindowOpen()).toBe(true);
    hidePieWindow();
    expect(isPieWindowOpen()).toBe(false);
  });

  it('is cancelled by reopening', () => {
    hidePieWindow();
    showPieWindowAtCursor();
    letAnimationFinish();
    expect(fake.hide).not.toHaveBeenCalled();
    expect(fake.send).toHaveBeenLastCalledWith('window:phase', 'opening');
    expect(isPieWindowOpen()).toBe(true);
  });
});

describe('the opening animation', () => {
  it('is requested each time the donut opens', () => {
    fake.visible = false;
    showPieWindowAtCursor();
    expect(fake.send).toHaveBeenCalledExactlyOnceWith(
      'window:phase',
      'opening',
    );
  });

  it('starts from nothing the first time, once the page has loaded hidden', () => {
    fake.visible = false;
    fake.loadHandlers.get('did-finish-load')?.();
    expect(fake.send).toHaveBeenCalledExactlyOnceWith(
      'window:phase',
      'closing',
    );
  });
});
