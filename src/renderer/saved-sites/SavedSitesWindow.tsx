import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { Settings } from '../../shared/types';
import { savedSitesBridge } from './saved-sites-bridge';
import { SavedSites } from './SavedSites';

// The saved sites in their own window. Its violet look comes from the
// .saved-sites styles, not from the accent you picked.
export function SavedSitesWindow() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const load = () =>
      void savedSitesBridge.settings.get().then((result) => {
        if (result.ok) {
          setSettings(result.value);
        }
      });
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  return (
    <div className="panel saved-sites-window" data-theme={settings.theme}>
      <SavedSites />
    </div>
  );
}
