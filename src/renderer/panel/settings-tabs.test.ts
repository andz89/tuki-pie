import { describe, expect, it } from 'vitest';
import type { PanelFormRequest } from '../../shared/types';
import { SETTINGS_TABS, nextTab, tabForRequest } from './settings-tabs';

describe('SETTINGS_TABS', () => {
  it('lists the tabs in order', () => {
    expect(SETTINGS_TABS.map(({ label }) => label)).toEqual([
      'Shortcuts',
      'Apps',
      'Snippets',
      'Suggestions',
      'Appearance',
      'Allowed Apps',
      'Chrome',
    ]);
  });
});

describe('tabForRequest', () => {
  it.each<PanelFormRequest>([
    { kind: 'snippet-new' },
    { kind: 'snippet-edit', id: 'a' },
    { kind: 'snippets-section' },
  ])('opens Snippets for $kind', (request) => {
    expect(tabForRequest(request)).toBe('snippets');
  });

  it.each<PanelFormRequest>([
    { kind: 'shortcut', parentId: null },
    { kind: 'group' },
    { kind: 'section' },
  ])('opens Shortcuts for $kind', (request) => {
    expect(tabForRequest(request)).toBe('shortcuts');
  });
});

describe('nextTab', () => {
  it('moves to the next tab', () => {
    expect(nextTab('shortcuts', 1)).toBe('apps');
  });

  it('moves to the previous tab', () => {
    expect(nextTab('appearance', -1)).toBe('suggestions');
  });

  it('wraps from the last tab to the first', () => {
    expect(nextTab('chrome', 1)).toBe('shortcuts');
  });

  it('wraps from the first tab to the last', () => {
    expect(nextTab('shortcuts', -1)).toBe('chrome');
  });
});
