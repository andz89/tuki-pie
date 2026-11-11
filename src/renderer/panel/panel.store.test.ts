import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type {
  Result,
  Shortcut,
  Snippet,
  SuggestionGroup,
} from '../../shared/types';
import { panelBridge } from './panel-bridge';
import { usePanelStore } from './panel.store';

vi.mock('./panel-bridge', () => ({
  panelBridge: {
    shortcuts: {
      list: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
      move: vi.fn(),
    },
    snippets: {
      list: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    },
    suggestions: { list: vi.fn(), change: vi.fn() },
    takeFormRequest: vi.fn(),
    settings: { get: vi.fn(), update: vi.fn() },
    allowedApps: { list: vi.fn(), remove: vi.fn() },
    pickPath: vi.fn(),
  },
}));

const LINK: Shortcut = {
  id: 'l',
  label: 'Mail',
  type: 'link',
  target: 'https://a.com',
  parentId: null,
  position: 0,
};
const GROUP: Shortcut = {
  id: 'g',
  label: 'Work',
  type: 'group',
  target: null,
  parentId: null,
  position: 1,
};
const INNER_A: Shortcut = { ...LINK, id: 'a', parentId: 'g', position: 0 };
const INNER_B: Shortcut = { ...LINK, id: 'b', parentId: 'g', position: 1 };

const store = () => usePanelStore.getState();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(panelBridge.allowedApps.list).mockResolvedValue({
    ok: true,
    value: [],
  });
  vi.mocked(panelBridge.shortcuts.list).mockResolvedValue({
    ok: true,
    value: [],
  });
  vi.mocked(panelBridge.snippets.list).mockResolvedValue({
    ok: true,
    value: [],
  });
  vi.mocked(panelBridge.suggestions.list).mockResolvedValue({
    ok: true,
    value: [],
  });
  usePanelStore.setState({
    shortcuts: [],
    snippets: [],
    suggestions: [],
    formRequest: null,
    allowedApps: [],
    error: null,
    activeTab: 'shortcuts',
  });
});

describe('snippets in the settings window', () => {
  const A: Snippet = { id: 'a', label: 'A', content: 'x', position: 0 };
  const B: Snippet = { id: 'b', label: 'B', content: 'y', position: 1 };
  const NEW_SNIPPET = { label: 'A', content: 'x' };

  const stubSettings = () =>
    vi.mocked(panelBridge.settings.get).mockResolvedValue({
      ok: true,
      value: DEFAULT_SETTINGS,
    });

  it('loads them', async () => {
    stubSettings();
    vi.mocked(panelBridge.snippets.list).mockResolvedValue({
      ok: true,
      value: [A],
    });
    await store().load();
    expect(store().snippets).toEqual([A]);
  });

  it('stores the answer after adding', async () => {
    vi.mocked(panelBridge.snippets.add).mockResolvedValue({
      ok: true,
      value: [A],
    });
    await expect(store().addSnippet(NEW_SNIPPET)).resolves.toBe(true);
    expect(store().snippets).toEqual([A]);
  });

  it('shows why adding failed', async () => {
    vi.mocked(panelBridge.snippets.add).mockResolvedValue({
      ok: false,
      error: 'You can save 8 snippets at most.',
    });
    await expect(store().addSnippet(NEW_SNIPPET)).resolves.toBe(false);
    expect(store().error).toBe('You can save 8 snippets at most.');
  });

  it('stores the answer after updating', async () => {
    const changed = { ...A, content: 'new' };
    vi.mocked(panelBridge.snippets.update).mockResolvedValue({
      ok: true,
      value: [changed],
    });
    await expect(
      store().updateSnippet({ id: 'a', label: 'A', content: 'new' }),
    ).resolves.toBe(true);
    expect(store().snippets).toEqual([changed]);
  });

  it('stores the answer after removing', async () => {
    usePanelStore.setState({ snippets: [A, B] });
    vi.mocked(panelBridge.snippets.remove).mockResolvedValue({
      ok: true,
      value: [B],
    });
    await store().removeSnippet('a');
    expect(store().snippets).toEqual([B]);
  });

  it('moves a snippet earlier', async () => {
    usePanelStore.setState({ snippets: [A, B] });
    vi.mocked(panelBridge.snippets.reorder).mockResolvedValue({
      ok: true,
      value: [B, A],
    });
    await store().moveSnippet('b', -1);
    expect(panelBridge.snippets.reorder).toHaveBeenCalledExactlyOnceWith([
      'b',
      'a',
    ]);
  });

  it('does not move the first snippet earlier', async () => {
    usePanelStore.setState({ snippets: [A, B] });
    await store().moveSnippet('a', -1);
    expect(panelBridge.snippets.reorder).not.toHaveBeenCalled();
  });

  it('shows a message on request', () => {
    store().showError('That snippet no longer exists.');
    expect(store().error).toBe('That snippet no longer exists.');
  });

  it('refresh loads before it picks up a form request', async () => {
    stubSettings();
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: null,
    });
    let finishLoading!: (result: Result<Snippet[]>) => void;
    vi.mocked(panelBridge.snippets.list).mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoading = resolve;
      }),
    );

    const done = store().refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(panelBridge.takeFormRequest).not.toHaveBeenCalled();

    finishLoading({ ok: true, value: [A] });
    await done;
    expect(panelBridge.takeFormRequest).toHaveBeenCalledOnce();
  });
});

describe('shortcuts in the settings window', () => {
  const NEW_LINK = {
    type: 'link',
    label: 'Mail',
    target: 'https://a.com',
    parentId: null,
  } as const;

  it('loads them', async () => {
    vi.mocked(panelBridge.settings.get).mockResolvedValue({
      ok: false,
      error: 'x',
    });
    vi.mocked(panelBridge.shortcuts.list).mockResolvedValue({
      ok: true,
      value: [LINK],
    });
    await store().load();
    expect(store().shortcuts).toEqual([LINK]);
  });

  it('shows why a shortcut could not be added, and keeps the list', async () => {
    usePanelStore.setState({ shortcuts: [LINK] });
    vi.mocked(panelBridge.shortcuts.add).mockResolvedValue({
      ok: false,
      error: 'This row can hold 8 shortcuts at most.',
    });
    await expect(store().addShortcut(NEW_LINK)).resolves.toBe(false);
    expect(store().error).toBe('This row can hold 8 shortcuts at most.');
    expect(store().shortcuts).toEqual([LINK]);
  });

  it('refreshes the allowed apps after saving', async () => {
    vi.mocked(panelBridge.shortcuts.add).mockResolvedValue({
      ok: true,
      value: [LINK],
    });
    vi.mocked(panelBridge.allowedApps.list).mockResolvedValue({
      ok: true,
      value: ['C:\\e.exe'],
    });
    await expect(store().addShortcut(NEW_LINK)).resolves.toBe(true);
    expect(store().allowedApps).toEqual(['C:\\e.exe']);
  });

  it('moves a shortcut within its own row only', async () => {
    usePanelStore.setState({ shortcuts: [LINK, GROUP, INNER_A, INNER_B] });
    vi.mocked(panelBridge.shortcuts.reorder).mockResolvedValue({
      ok: true,
      value: [],
    });
    await store().moveShortcut('b', -1);
    expect(panelBridge.shortcuts.reorder).toHaveBeenCalledExactlyOnceWith('g', [
      'b',
      'a',
    ]);
  });

  it('does nothing when moving past the end of a row', async () => {
    usePanelStore.setState({ shortcuts: [LINK, GROUP, INNER_A, INNER_B] });
    await store().moveShortcut('b', 1);
    expect(panelBridge.shortcuts.reorder).not.toHaveBeenCalled();
  });

  it('moves a shortcut to another row and shows the result', async () => {
    vi.mocked(panelBridge.shortcuts.move).mockResolvedValue({
      ok: true,
      value: [LINK],
    });
    await store().placeShortcut('l', 'g', 0);
    expect(panelBridge.shortcuts.move).toHaveBeenCalledExactlyOnceWith(
      'l',
      'g',
      0,
    );
    expect(store().shortcuts).toEqual([LINK]);
  });

  it('picks up a waiting form request', async () => {
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: { kind: 'group' },
    });
    await store().pickUpFormRequest();
    expect(store().formRequest).toEqual({ kind: 'group' });
  });

  it('keeps a request when nothing new is waiting', async () => {
    usePanelStore.setState({ formRequest: { kind: 'section' } });
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: null,
    });
    await store().pickUpFormRequest();
    expect(store().formRequest).toEqual({ kind: 'section' });
  });

  it('does not wipe an error shown to the person', async () => {
    usePanelStore.setState({ error: 'Something failed.' });
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: null,
    });
    await store().pickUpFormRequest();
    expect(store().error).toBe('Something failed.');
  });
});

describe('the settings tabs', () => {
  it('starts on Shortcuts', () => {
    expect(store().activeTab).toBe('shortcuts');
  });

  it('changes tab when asked', () => {
    store().setActiveTab('appearance');
    expect(store().activeTab).toBe('appearance');
  });

  it('jumps to Snippets for a snippet request', async () => {
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: { kind: 'snippet-edit', id: 'a' },
    });
    await store().pickUpFormRequest();
    expect(store().activeTab).toBe('snippets');
  });

  it('jumps to Shortcuts for a shortcut request', async () => {
    usePanelStore.setState({ activeTab: 'appearance' });
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: { kind: 'group' },
    });
    await store().pickUpFormRequest();
    expect(store().activeTab).toBe('shortcuts');
  });

  it('stays on the chosen tab when nothing is waiting', async () => {
    usePanelStore.setState({ activeTab: 'appearance' });
    vi.mocked(panelBridge.takeFormRequest).mockResolvedValue({
      ok: true,
      value: null,
    });
    await store().pickUpFormRequest();
    expect(store().activeTab).toBe('appearance');
  });
});

describe('panel store', () => {
  it('loads everything the window shows', async () => {
    vi.mocked(panelBridge.settings.get).mockResolvedValue({
      ok: true,
      value: {
        theme: 'light',
        accent: '#0F766E',
        size: 'medium',
        pin: 'unpinned',
        pageInfoOnTop: 'normal',
        openKeys: 'Ctrl+Alt+Space',
        linkFilter: '',
        suggestionsInChrome: 'on',
      },
    });
    vi.mocked(panelBridge.allowedApps.list).mockResolvedValue({
      ok: true,
      value: ['C:\\a.exe'],
    });

    await store().load();

    expect(store().settings.theme).toBe('light');
    expect(store().allowedApps).toEqual(['C:\\a.exe']);
  });

  it('keeps the message on screen when the window is reloaded on focus', async () => {
    vi.mocked(panelBridge.settings.get).mockResolvedValue({
      ok: true,
      value: DEFAULT_SETTINGS,
    });
    usePanelStore.setState({ error: 'Nothing found at that path.' });
    await store().load();
    expect(store().error).toBe('Nothing found at that path.');
  });

  it('shows a dragged accent at once and saves it once dragging pauses', async () => {
    vi.useFakeTimers();
    vi.mocked(panelBridge.settings.update).mockResolvedValue({
      ok: true,
      value: { ...DEFAULT_SETTINGS, accent: '#000005' },
    });
    for (let step = 1; step <= 5; step++) {
      store().dragAccent(`#00000${step}`);
    }
    expect(store().settings.accent).toBe('#000005');
    expect(panelBridge.settings.update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(panelBridge.settings.update).toHaveBeenCalledExactlyOnceWith({
      accent: '#000005',
    });
    vi.useRealTimers();
  });

  it('clears an old error after something works', async () => {
    usePanelStore.setState({ error: 'old' });
    vi.mocked(panelBridge.shortcuts.remove).mockResolvedValue({
      ok: true,
      value: [],
    });
    await store().removeShortcut('l');
    expect(store().error).toBeNull();
  });

  it('applies a new look', async () => {
    vi.mocked(panelBridge.settings.update).mockResolvedValue({
      ok: true,
      value: {
        theme: 'light',
        accent: '#2563EB',
        size: 'medium',
        pin: 'unpinned',
        pageInfoOnTop: 'normal',
        openKeys: 'Ctrl+Alt+Space',
        linkFilter: '',
        suggestionsInChrome: 'on',
      },
    });
    await store().updateSettings({ theme: 'light' });
    expect(panelBridge.settings.update).toHaveBeenCalledExactlyOnceWith({
      theme: 'light',
    });
    expect(store().settings.theme).toBe('light');
  });

  it('removes an allowed app', async () => {
    usePanelStore.setState({ allowedApps: ['C:\\a.exe'] });
    vi.mocked(panelBridge.allowedApps.remove).mockResolvedValue({
      ok: true,
      value: [],
    });
    await store().removeAllowedApp('C:\\a.exe');
    expect(store().allowedApps).toEqual([]);
  });

  it('shows why an allowed app cannot be removed', async () => {
    vi.mocked(panelBridge.allowedApps.remove).mockResolvedValue({
      ok: false,
      error: 'Editor still uses this app.',
    });
    await store().removeAllowedApp('C:\\a.exe');
    expect(store().error).toBe('Editor still uses this app.');
  });

  it('returns the chosen path', async () => {
    vi.mocked(panelBridge.pickPath).mockResolvedValue({
      ok: true,
      value: 'C:\\Picked',
    });
    await expect(store().pickPath('folder')).resolves.toBe('C:\\Picked');
  });

  it('returns nothing when the picker is cancelled', async () => {
    vi.mocked(panelBridge.pickPath).mockResolvedValue({
      ok: true,
      value: null,
    });
    await expect(store().pickPath('folder')).resolves.toBeNull();
  });
});

describe('suggestions in the settings window', () => {
  const DAY: SuggestionGroup = {
    id: 'd',
    name: 'Day',
    collapsed: false,
    values: [
      { value: '1', label: null, hidden: false },
      { value: '2', label: null, hidden: false },
    ],
  };
  const MONTH: SuggestionGroup = { ...DAY, id: 'm', name: 'Month' };

  it('loads them', async () => {
    vi.mocked(panelBridge.settings.get).mockResolvedValue({
      ok: true,
      value: DEFAULT_SETTINGS,
    });
    vi.mocked(panelBridge.suggestions.list).mockResolvedValue({
      ok: true,
      value: [DAY],
    });
    await store().load();
    expect(store().suggestions).toEqual([DAY]);
  });

  it('stores the answer after a change', async () => {
    vi.mocked(panelBridge.suggestions.change).mockResolvedValue({
      ok: true,
      value: [DAY],
    });
    await expect(
      store().changeSuggestions({ kind: 'add-group', name: 'Day' }),
    ).resolves.toBe(true);
    expect(store().suggestions).toEqual([DAY]);
  });

  it('shows why a change failed', async () => {
    usePanelStore.setState({ suggestions: [DAY] });
    vi.mocked(panelBridge.suggestions.change).mockResolvedValue({
      ok: false,
      error: 'You can have 50 groups at most.',
    });
    await expect(
      store().changeSuggestions({ kind: 'add-group', name: 'X' }),
    ).resolves.toBe(false);
    expect(store().error).toBe('You can have 50 groups at most.');
    expect(store().suggestions).toEqual([DAY]);
  });

  it('moves a dragged group to where it was dropped', async () => {
    usePanelStore.setState({ suggestions: [DAY, MONTH] });
    vi.mocked(panelBridge.suggestions.change).mockResolvedValue({
      ok: true,
      value: [MONTH, DAY],
    });
    await store().moveSuggestionGroup(0, 2);
    expect(panelBridge.suggestions.change).toHaveBeenCalledExactlyOnceWith({
      kind: 'reorder-groups',
      ids: ['m', 'd'],
    });
  });

  it('sends nothing when a group is dropped where it was', async () => {
    usePanelStore.setState({ suggestions: [DAY, MONTH] });
    await store().moveSuggestionGroup(0, 0);
    await store().moveSuggestionGroup(0, 1);
    expect(panelBridge.suggestions.change).not.toHaveBeenCalled();
  });
});
