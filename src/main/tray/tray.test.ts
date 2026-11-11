import { Menu, Tray } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTray } from './tray';

const trayInstance = vi.hoisted(() => ({
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  on: vi.fn(),
}));

vi.mock('electron', () => ({
  Tray: vi.fn(function Tray() {
    return trayInstance;
  }),
  Menu: { buildFromTemplate: vi.fn((template) => template) },
  nativeImage: { createFromBitmap: vi.fn(() => 'icon') },
}));

type MenuItem = { label?: string; click?: () => void };

function menuItem(label: string): MenuItem {
  const [template] = vi.mocked(Menu.buildFromTemplate).mock.calls[0] as [
    MenuItem[],
  ];
  const item = template.find((entry) => entry.label === label);
  if (!item) throw new Error(`no ${label} menu item`);
  return item;
}

const openSettings = vi.fn();
const quit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  createTray({ openSettings, quit });
});

describe('createTray', () => {
  it('creates the tray icon', () => {
    expect(Tray).toHaveBeenCalledExactlyOnceWith('icon');
  });

  it('opens Settings from the menu', () => {
    menuItem('Settings').click?.();
    expect(openSettings).toHaveBeenCalledOnce();
  });

  it('quits from the menu', () => {
    menuItem('Quit').click?.();
    expect(quit).toHaveBeenCalledOnce();
  });

  it('opens Settings when the icon is clicked', () => {
    const [event, listener] = trayInstance.on.mock.calls[0];
    expect(event).toBe('click');
    expect(listener).toBe(openSettings);
  });
});
