import type { PanelFormRequest } from '../../shared/types';
import { isAppRequest, isSnippetRequest } from './form-request';

export type SettingsTab =
  | 'shortcuts'
  | 'apps'
  | 'snippets'
  | 'suggestions'
  | 'appearance'
  | 'allowed-apps'
  | 'chrome';

export const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'apps', label: 'Apps' },
  { id: 'snippets', label: 'Snippets' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'allowed-apps', label: 'Allowed Apps' },
  { id: 'chrome', label: 'Chrome' },
];

// The tab that holds the form the donut asked for.
export function tabForRequest(request: PanelFormRequest): SettingsTab {
  if (isSnippetRequest(request)) {
    return 'snippets';
  }
  return isAppRequest(request) ? 'apps' : 'shortcuts';
}

export function nextTab(current: SettingsTab, step: 1 | -1): SettingsTab {
  const count = SETTINGS_TABS.length;
  const index = SETTINGS_TABS.findIndex(({ id }) => id === current);
  return SETTINGS_TABS[(index + step + count) % count].id;
}
