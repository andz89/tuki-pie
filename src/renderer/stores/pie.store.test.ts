import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTES_INDEX,
  PAGE_INFO_INDEX,
  SCREENSHOT_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
  SNIPPETS_INDEX,
  ZIP_INDEX,
} from '../components/slice-display';
import { bridge } from '../api/bridge';
import { appIconKey, usePieStore } from './pie.store';
import { useSettingsStore } from './settings.store';

vi.mock('../api/bridge', () => ({
  bridge: {
    shortcuts: {
      list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      open: vi.fn(),
      icon: vi
        .fn()
        .mockResolvedValue({ ok: true, value: 'data:image/png;base64,AA' }),
    },
    snippets: {
      list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      copy: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    },
    screenshot: {
      take: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    },
    zip: {
      count: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
      create: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    },
    window: {
      dismiss: vi.fn().mockResolvedValue(undefined),
      hide: vi.fn().mockResolvedValue(undefined),
      moveBy: vi.fn().mockResolvedValue(undefined),
      openSettings: vi.fn().mockResolvedValue(undefined),
      openShortcutForm: vi.fn().mockResolvedValue(undefined),
      openPageInfo: vi.fn().mockResolvedValue(undefined),
      openNotes: vi.fn().mockResolvedValue(undefined),
      volume: vi.fn().mockResolvedValue(undefined),
      setListSide: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

const store = () => usePieStore.getState();

beforeEach(() => {
  vi.mocked(bridge.window.dismiss).mockClear();
  vi.mocked(bridge.window.hide).mockClear();
  vi.mocked(bridge.window.moveBy).mockClear();
  vi.mocked(bridge.window.openSettings).mockClear();
  vi.mocked(bridge.window.openShortcutForm).mockClear();
  vi.mocked(bridge.window.volume).mockClear();
  useSettingsStore.setState({ pin: 'unpinned' });
  usePieStore.setState({
    hoveredIndex: null,
    error: null,
    circleHint: null,
    snippets: [],
    notice: null,
  });
});

describe('the Zip slice', () => {
  it('asks how many images were selected each time the donut opens', async () => {
    vi.mocked(bridge.zip.count).mockResolvedValueOnce({ ok: true, value: 3 });
    await store().load();
    await vi.waitFor(() => expect(store().zipCount).toBe(3));
  });

  it('counts none when Explorer could not be asked', async () => {
    vi.mocked(bridge.zip.count).mockResolvedValueOnce({
      ok: false,
      error: 'nope',
    });
    await store().loadZipCount();
    expect(store().zipCount).toBe(0);
  });

  it('asks for a name on a click, without zipping yet', () => {
    vi.mocked(bridge.zip.create).mockClear();
    usePieStore.setState({ zipCount: 2 });
    store().openRingItem(ZIP_INDEX);
    expect(store().zipNaming).toBe(true);
    expect(bridge.zip.create).not.toHaveBeenCalled();
  });

  it('says what to do instead of asking when no images were selected', () => {
    usePieStore.setState({ zipCount: 0 });
    store().openRingItem(ZIP_INDEX);
    expect(store().zipNaming).toBe(false);
    expect(store().error).toMatch(/Select images/);
  });

  it('zips under the typed name and closes the donut', async () => {
    vi.mocked(bridge.zip.create).mockClear();
    usePieStore.setState({ zipNaming: true });
    await store().zipImages('Holiday');
    expect(bridge.zip.create).toHaveBeenCalledExactlyOnceWith('Holiday');
    expect(store().zipNaming).toBe(false);
    expect(bridge.window.dismiss).toHaveBeenCalled();
  });

  it('goes back to the donut on Esc', () => {
    usePieStore.setState({ zipNaming: true });
    store().cancelZip();
    expect(store().zipNaming).toBe(false);
  });

  it('closes the name box when the donut opens again', () => {
    usePieStore.setState({ zipNaming: true });
    store().opened();
    expect(store().zipNaming).toBe(false);
  });

  it('stays open with the reason when zipping fails', async () => {
    vi.mocked(bridge.zip.create).mockResolvedValueOnce({
      ok: false,
      error: 'Could not save the zip there.',
    });
    await store().zipImages('x');
    expect(store().error).toBe('Could not save the zip there.');
    expect(bridge.window.dismiss).not.toHaveBeenCalled();
  });
});

describe('loading', () => {
  it('clears an old error', async () => {
    usePieStore.setState({ error: 'old' });
    await store().load();
    expect(store().error).toBeNull();
  });

  it('keeps the highlight on a reload, as a click on the donut gives it focus', async () => {
    usePieStore.setState({ hoveredIndex: 1 });
    await store().load();
    expect(store().hoveredIndex).toBe(1);
  });

  it('keeps the highlight while pinned, so a first click still lands', async () => {
    useSettingsStore.setState({ pin: 'pinned' });
    usePieStore.setState({ hoveredIndex: 1 });
    await store().load();
    expect(store().hoveredIndex).toBe(1);
  });

  it('shows why loading failed', async () => {
    vi.mocked(bridge.shortcuts.list).mockResolvedValueOnce({
      ok: false,
      error: 'Could not load.',
    });
    await store().load();
    expect(store().error).toBe('Could not load.');
  });
});

describe('opening a ring segment', () => {
  it('opens the Shortcuts part of Settings', () => {
    store().openRingItem(SHORTCUTS_INDEX);
    expect(bridge.window.openShortcutForm).toHaveBeenCalledExactlyOnceWith({
      kind: 'section',
    });
  });

  it('opens Settings', () => {
    store().openRingItem(SETTINGS_INDEX);
    expect(bridge.window.openSettings).toHaveBeenCalledOnce();
  });

  it('opens Page Info and clears the donut', () => {
    vi.mocked(bridge.window.openPageInfo).mockClear();
    usePieStore.setState({
      hoveredIndex: PAGE_INFO_INDEX,
      error: 'old',
      circleHint: { label: 'a', value: 'b' },
    });
    store().openRingItem(PAGE_INFO_INDEX);
    expect(bridge.window.openPageInfo).toHaveBeenCalledOnce();
    expect(store().hoveredIndex).toBeNull();
    expect(store().error).toBeNull();
    expect(store().circleHint).toBeNull();
  });

  it('opens Notes and clears the donut', () => {
    vi.mocked(bridge.window.openNotes).mockClear();
    usePieStore.setState({ hoveredIndex: NOTES_INDEX, error: 'old' });
    store().openRingItem(NOTES_INDEX);
    expect(bridge.window.openNotes).toHaveBeenCalledOnce();
    expect(store().hoveredIndex).toBeNull();
    expect(store().error).toBeNull();
  });

  it('opens the Snippets part of Settings', () => {
    store().openRingItem(SNIPPETS_INDEX);
    expect(bridge.window.openShortcutForm).toHaveBeenCalledExactlyOnceWith({
      kind: 'snippets-section',
    });
  });

  it('picks a section when the Screenshot slice is clicked', () => {
    vi.mocked(bridge.screenshot.take).mockClear();
    usePieStore.setState({ hoveredIndex: SCREENSHOT_INDEX });
    store().openRingItem(SCREENSHOT_INDEX);
    expect(bridge.screenshot.take).toHaveBeenCalledExactlyOnceWith('section');
    expect(store().hoveredIndex).toBeNull();
  });
});

describe('snippets', () => {
  const NOTE = { id: 'a', label: 'Note', content: 'text', position: 0 };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads them when the donut opens', async () => {
    vi.mocked(bridge.snippets.list).mockResolvedValueOnce({
      ok: true,
      value: [NOTE],
    });
    await store().load();
    expect(store().snippets).toEqual([NOTE]);
  });

  it('dismisses after a copy, with no notice when unpinned', async () => {
    await store().copySnippet('a');
    expect(bridge.snippets.copy).toHaveBeenCalledWith('a');
    expect(bridge.window.dismiss).toHaveBeenCalledOnce();
    expect(store().notice).toBeNull();
  });

  it('a failed copy shows why and does not dismiss', async () => {
    vi.mocked(bridge.snippets.copy).mockResolvedValueOnce({
      ok: false,
      error: 'Could not copy that snippet.',
    });
    await store().copySnippet('a');
    expect(store().error).toBe('Could not copy that snippet.');
    expect(bridge.window.dismiss).not.toHaveBeenCalled();
  });

  it('shows Copied on a pinned donut, then clears it', async () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ pin: 'pinned' });
    await store().copySnippet('a');
    expect(store().notice).toBe('Copied');
    vi.advanceTimersByTime(1200);
    expect(store().notice).toBeNull();
  });

  it('a second copy restarts the notice', async () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ pin: 'pinned' });
    await store().copySnippet('a');
    vi.advanceTimersByTime(1000);
    await store().copySnippet('b');
    vi.advanceTimersByTime(1000);
    expect(store().notice).toBe('Copied');
    vi.advanceTimersByTime(200);
    expect(store().notice).toBeNull();
  });
});

describe('shortcuts', () => {
  const MAIL = {
    id: 'mail',
    label: 'Mail',
    type: 'link',
    target: 'https://a.com',
    parentId: null,
    position: 0,
  } as const;

  it('loads them when the donut opens', async () => {
    vi.mocked(bridge.shortcuts.list).mockResolvedValueOnce({
      ok: true,
      value: [MAIL],
    });
    await store().load();
    expect(store().shortcuts).toEqual([MAIL]);
  });

  it('dismisses the donut by the pin rule once one opened', async () => {
    vi.mocked(bridge.shortcuts.open).mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });
    await store().openShortcut('mail');
    expect(bridge.shortcuts.open).toHaveBeenCalledWith('mail');
    expect(bridge.window.dismiss).toHaveBeenCalledOnce();
  });

  it('explains when one could not open, and stays', async () => {
    vi.mocked(bridge.shortcuts.open).mockResolvedValueOnce({
      ok: false,
      error: 'Could not open Mail.',
    });
    await store().openShortcut('mail');
    expect(store().error).toBe('Could not open Mail.');
    expect(bridge.window.dismiss).not.toHaveBeenCalled();
  });
});

describe('the message in the center', () => {
  it('goes away when another slice is pointed at', () => {
    usePieStore.setState({ error: 'Folder not found.' });
    store().setHovered(0);
    expect(store().error).toBeNull();
  });

  it('stays when the mouse simply leaves a slice', () => {
    usePieStore.setState({ error: 'Folder not found.' });
    store().setHovered(null);
    expect(store().error).toBe('Folder not found.');
  });

  it('is cleared when the donut closes', () => {
    usePieStore.setState({ error: 'Folder not found.' });
    store().close();
    expect(store().error).toBeNull();
  });
});

describe('the Settings circles', () => {
  it('shows which circle is pointed at', () => {
    store().setCircleHint({ label: 'Theme', value: 'Dark' });
    expect(store().circleHint).toEqual({ label: 'Theme', value: 'Dark' });
  });

  it('forgets the circle when the donut closes', () => {
    store().setCircleHint({ label: 'Theme', value: 'Dark' });
    store().close();
    expect(store().circleHint).toBeNull();
  });

  it('changes the volume through the main process', () => {
    vi.useFakeTimers();
    store().changeVolume('up');
    expect(bridge.window.volume).toHaveBeenCalledExactlyOnceWith('up');
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('turns the volume one step per frame, however fast the wheel spins', () => {
    vi.useFakeTimers();
    for (let step = 0; step < 10; step++) {
      store().changeVolume('up');
    }
    expect(bridge.window.volume).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    store().changeVolume('up');
    expect(bridge.window.volume).toHaveBeenCalledTimes(2);
    store().changeVolume('mute');
    expect(bridge.window.volume).toHaveBeenLastCalledWith('mute');
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });
});

describe('window actions', () => {
  it('openSettings() asks for the settings window and clears the donut', () => {
    vi.mocked(bridge.window.openSettings).mockClear();
    usePieStore.setState({ hoveredIndex: 1, error: 'old' });
    store().openSettings();
    expect(bridge.window.openSettings).toHaveBeenCalledOnce();
    expect(store().hoveredIndex).toBeNull();
    expect(store().error).toBeNull();
  });

  it('close() clears the highlight and hides the window', () => {
    store().setHovered(0);
    store().close();
    expect(store().hoveredIndex).toBeNull();
    expect(bridge.window.hide).toHaveBeenCalledOnce();
  });

  it('dismiss() leaves the decision to the main process', () => {
    usePieStore.setState({ error: 'old' });
    store().dismiss();
    expect(bridge.window.dismiss).toHaveBeenCalledOnce();
    expect(bridge.window.hide).not.toHaveBeenCalled();
    expect(store().error).toBeNull();
  });

  it('moveWindowBy() passes the distance to the main process', () => {
    vi.useFakeTimers();
    store().moveWindowBy(12, -7);
    expect(bridge.window.moveBy).toHaveBeenCalledExactlyOnceWith(12, -7);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('sends the drag steps of one frame as one move', () => {
    vi.useFakeTimers();
    for (let step = 0; step < 5; step++) {
      store().moveWindowBy(1, 2);
    }
    expect(bridge.window.moveBy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    expect(bridge.window.moveBy).toHaveBeenCalledTimes(2);
    expect(bridge.window.moveBy).toHaveBeenLastCalledWith(4, 8);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });
});

describe('screenshots', () => {
  beforeEach(() => {
    vi.mocked(bridge.screenshot.take).mockClear();
  });

  it('takes the entire screen', async () => {
    await store().takeScreenshot('screen');
    expect(bridge.screenshot.take).toHaveBeenCalledExactlyOnceWith('screen');
    expect(store().error).toBeNull();
  });

  it('shows why a screenshot failed', async () => {
    vi.mocked(bridge.screenshot.take).mockResolvedValueOnce({
      ok: false,
      error: 'Could not capture the screen.',
    });
    await store().takeScreenshot('screen');
    expect(store().error).toBe('Could not capture the screen.');
  });
});

describe('the Shortcuts list', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(bridge.window.setListSide).mockClear();
    usePieStore.setState({
      listSide: null,
      hoveredIndex: null,
      openIndex: null,
      lockedIndex: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens beside the donut when Shortcuts is hovered', () => {
    store().setHovered(SHORTCUTS_INDEX);
    expect(store().listSide).not.toBeNull();
    expect(bridge.window.setListSide).toHaveBeenCalledWith(store().listSide);
  });

  it('stays when the mouse leaves into empty space, to come back to', () => {
    store().setHovered(SHORTCUTS_INDEX);
    store().setHovered(null);
    vi.advanceTimersByTime(1000);
    expect(store().listSide).not.toBeNull();
    expect(store().openIndex).toBe(SHORTCUTS_INDEX);
  });

  it('opens for Snippets too, and stays open moving between the two', () => {
    store().setHovered(SNIPPETS_INDEX);
    const side = store().listSide;
    expect(side).not.toBeNull();
    store().setHovered(SHORTCUTS_INDEX);
    expect(store().listSide).toBe(side);
    expect(store().openIndex).toBe(SHORTCUTS_INDEX);
  });

  it('closes when another slice is hovered', () => {
    store().setHovered(SHORTCUTS_INDEX);
    store().setHovered(SETTINGS_INDEX);
    expect(store().listSide).toBeNull();
    expect(bridge.window.setListSide).toHaveBeenLastCalledWith(null);
  });
});

describe('opening the window', () => {
  beforeEach(() => {
    vi.mocked(bridge.window.setListSide).mockClear();
    usePieStore.setState({
      listSide: null,
      hoveredIndex: null,
      openIndex: null,
      lockedIndex: null,
    });
  });

  it('starts an unpinned donut with nothing highlighted or open', () => {
    store().setHovered(SHORTCUTS_INDEX);
    store().opened();
    expect(store()).toMatchObject({
      hoveredIndex: null,
      openIndex: null,
      listSide: null,
    });
  });

  it('asks again for room for the list a pinned donut still shows', () => {
    useSettingsStore.setState({ pin: 'pinned' });
    store().setHovered(SHORTCUTS_INDEX);
    vi.mocked(bridge.window.setListSide).mockClear();
    // Main made the window a square again at the cursor.
    store().opened();
    expect(store().openIndex).toBe(SHORTCUTS_INDEX);
    expect(store().listSide).not.toBeNull();
    expect(bridge.window.setListSide).toHaveBeenCalledExactlyOnceWith(
      store().listSide,
    );
  });

  it('asks for nothing when a pinned donut shows no list', () => {
    useSettingsStore.setState({ pin: 'pinned' });
    store().opened();
    expect(bridge.window.setListSide).not.toHaveBeenCalled();
  });
});

describe('locking a slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(bridge.window.openShortcutForm).mockClear();
    usePieStore.setState({
      listSide: null,
      hoveredIndex: null,
      openIndex: null,
      lockedIndex: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const at = { x: 10, y: 10 };

  it('locks on a double-click, without running the single click', () => {
    store().pressSlice(SHORTCUTS_INDEX, at);
    store().pressSlice(SHORTCUTS_INDEX, at);
    vi.advanceTimersByTime(1000);
    expect(store().lockedIndex).toBe(SHORTCUTS_INDEX);
    expect(bridge.window.openShortcutForm).not.toHaveBeenCalled();
  });

  it('runs a single click after waiting for a second one', () => {
    store().pressSlice(SHORTCUTS_INDEX, at);
    expect(bridge.window.openShortcutForm).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(bridge.window.openShortcutForm).toHaveBeenCalledWith({
      kind: 'section',
    });
  });

  it('ignores the other slices while locked', () => {
    store().pressSlice(SHORTCUTS_INDEX, at);
    store().pressSlice(SHORTCUTS_INDEX, at);
    store().setHovered(SETTINGS_INDEX, at);
    store().setHovered(null, at);
    store().pressSlice(PAGE_INFO_INDEX, at);
    vi.advanceTimersByTime(1000);
    expect(store().openIndex).toBe(SHORTCUTS_INDEX);
    expect(store().hoveredIndex).toBe(SHORTCUTS_INDEX);
    expect(store().listSide).not.toBeNull();
  });

  it('unlocks on a double-click anywhere on the donut', () => {
    store().pressSlice(SHORTCUTS_INDEX, at);
    store().pressSlice(SHORTCUTS_INDEX, at);
    vi.advanceTimersByTime(1000);
    store().pressSlice(PAGE_INFO_INDEX, at);
    store().pressSlice(PAGE_INFO_INDEX, at);
    expect(store().lockedIndex).toBeNull();
    expect(store().hoveredIndex).toBe(PAGE_INFO_INDEX);
  });
});

describe('app icons', () => {
  beforeEach(() => {
    vi.mocked(bridge.shortcuts.icon).mockClear();
    usePieStore.setState({ appIcons: {} });
  });

  it('reads each app icon once and keeps it', async () => {
    await store().loadAppIcon('app-1', 'C:\\a.exe');
    await store().loadAppIcon('app-1', 'C:\\a.exe');
    expect(store().appIcons[appIconKey('app-1', 'C:\\a.exe')]).toBe(
      'data:image/png;base64,AA',
    );
    expect(bridge.shortcuts.icon).toHaveBeenCalledTimes(1);
  });

  it('reads the icon again once the app points somewhere else', async () => {
    await store().loadAppIcon('app-1', 'C:\\a.exe');
    await store().loadAppIcon('app-1', 'C:\\b.exe');
    expect(bridge.shortcuts.icon).toHaveBeenCalledTimes(2);
  });

  it('tries again next time when reading failed', async () => {
    vi.mocked(bridge.shortcuts.icon).mockResolvedValueOnce({
      ok: false,
      error: 'busy',
    });
    await store().loadAppIcon('app-1', 'C:\\a.exe');
    expect(store().appIcons[appIconKey('app-1', 'C:\\a.exe')]).toBeUndefined();
    await store().loadAppIcon('app-1', 'C:\\a.exe');
    expect(store().appIcons[appIconKey('app-1', 'C:\\a.exe')]).toBe(
      'data:image/png;base64,AA',
    );
  });

  it('asks once while a read is still on its way', async () => {
    await Promise.all([
      store().loadAppIcon('app-1', 'C:\\a.exe'),
      store().loadAppIcon('app-1', 'C:\\a.exe'),
    ]);
    expect(bridge.shortcuts.icon).toHaveBeenCalledTimes(1);
  });
});
