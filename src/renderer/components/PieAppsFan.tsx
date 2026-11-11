import { useEffect } from 'react';
import { MAX_APPS } from '../../shared/schemas/shortcut.schema';
import { appIconKey, usePieStore } from '../stores/pie.store';
import { PieFanRow } from './PieFanRow';
import type { FanCircle } from './PieFanRow';
import { firstLetter } from './shortcut-row';

// Every app shortcut, from any group, as a circle with the app's own icon.
export function PieAppsFan({ middle }: { middle: number }) {
  const shortcuts = usePieStore((state) => state.shortcuts);
  const appIcons = usePieStore((state) => state.appIcons);
  const loadShortcuts = usePieStore((state) => state.loadShortcuts);
  const loadAppIcon = usePieStore((state) => state.loadAppIcon);
  const openShortcut = usePieStore((state) => state.openShortcut);
  const openShortcutForm = usePieStore((state) => state.openShortcutForm);

  const apps = shortcuts
    .filter((shortcut) => shortcut.type === 'app')
    .slice(0, MAX_APPS);

  // A pinned donut may not get focus after a change in the settings window.
  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  useEffect(() => {
    for (const { id, type, target } of shortcuts) {
      if (type === 'app') {
        void loadAppIcon(id, target);
      }
    }
  }, [shortcuts, loadAppIcon]);

  const circles: FanCircle[] = apps.map((app) => ({
    id: app.id,
    image: appIcons[appIconKey(app.id, app.target)] ?? undefined,
    letter: firstLetter(app.label),
    label: app.label,
    value: 'Open app',
    onClick: () => void openShortcut(app.id),
  }));

  // A full ring has no spot left for the add circle.
  if (apps.length < MAX_APPS)
    circles.push({
      id: 'add-app',
      icon: 'add',
      label: 'Add app',
      value: 'New app shortcut',
      onClick: () => openShortcutForm({ kind: 'app-new' }),
    });

  return (
    <PieFanRow className="pie-apps-fan" middle={middle} circles={circles} />
  );
}
