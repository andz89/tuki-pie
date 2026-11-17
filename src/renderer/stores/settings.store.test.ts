import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bridge } from '../api/bridge';
import { useSettingsStore } from './settings.store';

vi.mock('../api/bridge', () => ({
  bridge: { settings: { get: vi.fn(), update: vi.fn() } },
}));

beforeEach(() => {
  useSettingsStore.setState({ theme: 'dark', accent: '#2563EB' });
});

describe('settings store', () => {
  it('applies the saved look', async () => {
    vi.mocked(bridge.settings.get).mockResolvedValue({
      ok: true,
      value: {
        theme: 'light',
        accent: '#7C3AED',
        size: 'large',
        pin: 'unpinned',
        pageInfoOnTop: 'normal',
        openKeys: 'Ctrl+Alt+Space',
        linkFilter: '',
        suggestionsInChrome: 'on',
        infoCardLayout: 'sidebar',
        infoCardFields: 'title',
        linksOpenIn: 'chrome',
      },
    });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(useSettingsStore.getState().accent).toBe('#7C3AED');
  });

  it('applies a change as soon as it is saved', async () => {
    vi.mocked(bridge.settings.update).mockResolvedValue({
      ok: true,
      value: {
        theme: 'light',
        accent: '#2563EB',
        size: 'small',
        pin: 'unpinned',
        pageInfoOnTop: 'normal',
        openKeys: 'Ctrl+Alt+Space',
        linkFilter: '',
        suggestionsInChrome: 'on',
        infoCardLayout: 'sidebar',
        infoCardFields: 'title',
        linksOpenIn: 'chrome',
      },
    });
    await useSettingsStore.getState().update({ size: 'small' });
    expect(bridge.settings.update).toHaveBeenCalledExactlyOnceWith({
      size: 'small',
    });
    expect(useSettingsStore.getState().size).toBe('small');
  });

  it('keeps the current look if loading fails', async () => {
    vi.mocked(bridge.settings.get).mockResolvedValue({
      ok: false,
      error: 'nope',
    });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().theme).toBe('dark');
  });
});
