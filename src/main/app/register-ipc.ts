import { app } from 'electron';
import path from 'node:path';
import { registerChromeIpc } from '../ipc/chrome.ipc';
import { registerNotesIpc, registerReminderIpc } from '../ipc/notes.ipc';
import { registerPageInfoIpc } from '../ipc/page-info.ipc';
import { registerPanelIpc } from '../ipc/panel.ipc';
import { registerScreenshotIpc } from '../ipc/screenshot.ipc';
import { registerSettingsIpc } from '../ipc/settings.ipc';
import { registerShortcutIpc } from '../ipc/shortcuts.ipc';
import { registerSnippetIpc } from '../ipc/snippets.ipc';
import { registerSuggestionIpc } from '../ipc/suggestions.ipc';
import { registerVolumeIpc } from '../ipc/volume.ipc';
import { registerWindowIpc } from '../ipc/window.ipc';
import { registerZipIpc } from '../ipc/zip.ipc';
import { shortcutIcons } from '../shortcuts/shortcut-icon';
import type { Services } from './build-services';

// Every message the windows can send, once the services exist.
export function registerIpc({
  shortcuts,
  snippets,
  suggestions,
  notes,
  settings,
  zipSelection,
  slices,
  pairing,
  chromeBridge,
}: Services): void {
  registerWindowIpc();
  registerShortcutIpc(
    shortcuts,
    shortcutIcons(
      (id) => shortcuts.find(id),
      path.join(app.getPath('userData'), 'icon-cache'),
    ),
  );
  registerSnippetIpc(snippets);
  registerSuggestionIpc(suggestions);
  registerNotesIpc(notes);
  registerReminderIpc(notes);
  registerPageInfoIpc(settings);
  registerScreenshotIpc();
  registerZipIpc(zipSelection);
  registerSettingsIpc(settings);
  registerPanelIpc(slices);
  registerVolumeIpc();
  registerChromeIpc(pairing, chromeBridge);
}
