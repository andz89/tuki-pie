import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bridge } from '../api/bridge';
import {
  PAGE_INFO_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
} from '../components/slice-display';
import { usePieStore } from '../stores/pie.store';
import { handlePieKey, nextHoveredIndex } from './usePieKeyboard';

vi.mock('../api/bridge', () => ({
  bridge: {
    window: {
      dismiss: vi.fn().mockResolvedValue(undefined),
      hide: vi.fn().mockResolvedValue(undefined),
      openSettings: vi.fn().mockResolvedValue(undefined),
      openShortcutForm: vi.fn().mockResolvedValue(undefined),
      openPageInfo: vi.fn().mockResolvedValue(undefined),
      openNotes: vi.fn().mockResolvedValue(undefined),
      setListSide: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

const hovered = () => usePieStore.getState().hoveredIndex;

beforeEach(() => {
  vi.mocked(bridge.window.hide).mockClear();
  vi.mocked(bridge.window.openSettings).mockClear();
  vi.mocked(bridge.window.openShortcutForm).mockClear();
  usePieStore.setState({ hoveredIndex: null, error: null });
});

describe('nextHoveredIndex', () => {
  it('starts at the first slice when moving forward from nothing', () => {
    expect(nextHoveredIndex(null, 8, 1)).toBe(0);
  });

  it('starts at the last slice when moving backward from nothing', () => {
    expect(nextHoveredIndex(null, 8, -1)).toBe(7);
  });

  it('wraps from the last slice to the first', () => {
    expect(nextHoveredIndex(7, 8, 1)).toBe(0);
  });

  it('wraps from the first slice to the last', () => {
    expect(nextHoveredIndex(0, 8, -1)).toBe(7);
  });
});

describe('handlePieKey', () => {
  it.each(['ArrowRight', 'ArrowDown'])('%s moves clockwise', (key) => {
    usePieStore.getState().setHovered(1);
    handlePieKey(key);
    expect(hovered()).toBe(2);
  });

  it.each(['ArrowLeft', 'ArrowUp'])('%s moves counterclockwise', (key) => {
    usePieStore.getState().setHovered(2);
    handlePieKey(key);
    expect(hovered()).toBe(1);
  });

  it('highlights the first segment from nothing', () => {
    handlePieKey('ArrowRight');
    expect(hovered()).toBe(0);
  });

  it('wraps from the Settings segment back to the first', () => {
    usePieStore.getState().setHovered(SETTINGS_INDEX);
    handlePieKey('ArrowRight');
    expect(hovered()).toBe(0);
  });

  it('goes backward from the first segment to Settings', () => {
    usePieStore.getState().setHovered(0);
    handlePieKey('ArrowLeft');
    expect(hovered()).toBe(SETTINGS_INDEX);
  });

  it('Enter on the Settings segment opens Settings', () => {
    usePieStore.getState().setHovered(SETTINGS_INDEX);
    handlePieKey('Enter');
    expect(bridge.window.openSettings).toHaveBeenCalledOnce();
  });

  it('Enter on the Page Info segment opens it', () => {
    vi.mocked(bridge.window.openPageInfo).mockClear();
    usePieStore.getState().setHovered(PAGE_INFO_INDEX);
    handlePieKey('Enter');
    expect(bridge.window.openPageInfo).toHaveBeenCalledOnce();
  });

  it('Enter on the Shortcuts segment opens that part of Settings', () => {
    usePieStore.getState().setHovered(SHORTCUTS_INDEX);
    handlePieKey('Enter');
    expect(bridge.window.openShortcutForm).toHaveBeenCalledExactlyOnceWith({
      kind: 'section',
    });
  });

  it('Enter does nothing when no segment is highlighted', () => {
    handlePieKey('Enter');
    expect(bridge.window.openSettings).not.toHaveBeenCalled();
    expect(bridge.window.openShortcutForm).not.toHaveBeenCalled();
    expect(bridge.window.hide).not.toHaveBeenCalled();
  });

  it('Escape hides the donut', () => {
    handlePieKey('Escape');
    expect(bridge.window.hide).toHaveBeenCalledOnce();
  });

  it('reports whether it used the key', () => {
    expect(handlePieKey('ArrowRight')).toBe(true);
    expect(handlePieKey('a')).toBe(false);
  });

  it('leaves every key to the zip name box while it shows', () => {
    usePieStore.setState({ zipNaming: true });
    usePieStore.getState().setHovered(1);
    for (const key of ['ArrowRight', 'Enter', 'Escape']) {
      expect(handlePieKey(key)).toBe(false);
    }
    expect(hovered()).toBe(1);
    expect(bridge.window.hide).not.toHaveBeenCalled();
    usePieStore.setState({ zipNaming: false });
  });
});
