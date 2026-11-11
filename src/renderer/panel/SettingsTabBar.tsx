import type { KeyboardEvent } from 'react';
import { usePanelStore } from './panel.store';
import { SETTINGS_TABS, nextTab } from './settings-tabs';
import type { SettingsTab } from './settings-tabs';

export const tabButtonId = (tab: SettingsTab) => `settings-tab-${tab}`;
export const tabPanelId = (tab: SettingsTab) => `settings-panel-${tab}`;

export function SettingsTabBar() {
  const activeTab = usePanelStore((state) => state.activeTab);
  const setActiveTab = usePanelStore((state) => state.setActiveTab);

  const moveWithArrows = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const next = nextTab(activeTab, event.key === 'ArrowRight' ? 1 : -1);
    setActiveTab(next);
    document.getElementById(tabButtonId(next))?.focus();
  };

  return (
    <div
      className="settings-tabs"
      role="tablist"
      aria-label="Settings"
      onKeyDown={moveWithArrows}
    >
      {SETTINGS_TABS.map(({ id, label }) => (
        <button
          key={id}
          id={tabButtonId(id)}
          type="button"
          role="tab"
          className="settings-tab"
          aria-selected={activeTab === id}
          aria-controls={tabPanelId(id)}
          tabIndex={activeTab === id ? 0 : -1}
          onClick={() => setActiveTab(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
