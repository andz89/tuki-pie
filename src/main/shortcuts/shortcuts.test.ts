import { expect, it, vi } from 'vitest';
import { dismissPieWindow, hidePieWindow } from '../windows/pie-window';
import { startShortcuts } from './shortcuts';

const hook = vi.hoisted(() => ({
  handlers: new Map<string, (input: unknown) => void>(),
  focusKeys: [] as string[],
}));

vi.mock('electron', () => ({
  globalShortcut: {
    register: (key: string) => {
      hook.focusKeys.push(key);
      return true;
    },
  },
}));
vi.mock('uiohook-napi', () => ({
  UiohookKey: { F24: 1 },
  uIOhook: {
    on: (name: string, handler: (input: unknown) => void) =>
      hook.handlers.set(name, handler),
    start: () => undefined,
    keyTap: () => undefined,
  },
}));
vi.mock('../windows/pie-window', () => ({
  dismissPieWindow: vi.fn(),
  hidePieWindow: vi.fn(),
  isPieWindowOpen: () => true,
  showPieWindowAtCursor: vi.fn(),
}));

it('Ctrl + Shift + click on an open donut follows the pin rule', () => {
  startShortcuts();
  const click = {
    button: 1,
    x: 10,
    y: 10,
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
  };

  hook.handlers.get('mousedown')?.(click);
  hook.handlers.get('mouseup')?.(click);

  expect(dismissPieWindow).toHaveBeenCalledOnce();
  expect(hidePieWindow).not.toHaveBeenCalled();
});

it('hears the focus key whichever modifiers are still held', () => {
  hook.focusKeys.length = 0;
  startShortcuts();
  expect(hook.focusKeys.toSorted()).toEqual([
    'Ctrl+F24',
    'Ctrl+Shift+F24',
    'F24',
    'Shift+F24',
  ]);
});
