import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { formatKeys } from '../../shared/open-keys';
import { AllowedAppsSection } from './AllowedAppsSection';
import { AppsSection } from './AppsSection';
import { AppearanceSection } from './AppearanceSection';
import { ChromeSection } from './ChromeSection';
import { SettingsTabBar, tabButtonId, tabPanelId } from './SettingsTabBar';
import { ShortcutSection } from './ShortcutSection';
import { SnippetSection } from './SnippetSection';
import { SuggestionSection } from './SuggestionSection';
import { panelBridge } from './panel-bridge';
import { usePanelStore } from './panel.store';
import { SETTINGS_TABS } from './settings-tabs';
import type { SettingsTab } from './settings-tabs';

const TAB_CONTENT: Record<SettingsTab, ReactNode> = {
  shortcuts: <ShortcutSection />,
  apps: <AppsSection />,
  snippets: <SnippetSection />,
  suggestions: <SuggestionSection />,
  appearance: <AppearanceSection />,
  'allowed-apps': <AllowedAppsSection />,
  chrome: <ChromeSection />,
};

export function SettingsPanel() {
  const activeTab = usePanelStore((state) => state.activeTab);
  const settings = usePanelStore((state) => state.settings);
  const error = usePanelStore((state) => state.error);
  const refresh = usePanelStore((state) => state.refresh);
  const clearError = usePanelStore((state) => state.clearError);

  // Reloading on focus picks up changes made from the donut.
  useEffect(() => {
    const update = () => void refresh();
    update();
    window.addEventListener('focus', update);
    const stopListening = panelBridge.onFormRequested(update);
    return () => {
      window.removeEventListener('focus', update);
      stopListening();
    };
  }, [refresh]);

  return (
    <div
      className="panel"
      data-theme={settings.theme}
      style={{ '--accent': settings.accent } as CSSProperties}
    >
      <main className="panel-content">
        <header>
          <h1>Pie Launcher</h1>
          <p className="panel-hint">
            {settings.openKeys
              ? `Ctrl + Shift + click anywhere, or press ${formatKeys(settings.openKeys)}, to open the donut.`
              : 'Ctrl + Shift + click anywhere to open the donut.'}
          </p>
        </header>

        {error && (
          <div className="panel-error" role="alert">
            <span>{error}</span>
            <button type="button" className="button-quiet" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        <SettingsTabBar />

        {/* All stay mounted, so a half-typed form survives switching tabs. */}
        {SETTINGS_TABS.map(({ id }) => (
          <div
            key={id}
            id={tabPanelId(id)}
            role="tabpanel"
            aria-labelledby={tabButtonId(id)}
            hidden={activeTab !== id}
          >
            {TAB_CONTENT[id]}
          </div>
        ))}
      </main>
    </div>
  );
}
