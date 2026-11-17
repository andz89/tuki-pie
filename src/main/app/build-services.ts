import { Notification, app, clipboard, safeStorage, shell } from 'electron';
import path from 'node:path';
import { startChromeBridge } from '../chrome-bridge/chrome-connection';
import { PairingCode } from '../chrome-bridge/pairing-code';
import { SuggestionSync } from '../chrome-bridge/suggestion-sync';
import { canOpen, readLinkFilter } from '../../shared/link-rules';
import { openDatabase } from '../db/db';
import { ReminderScheduler } from '../notes/reminder-scheduler';
import { AllowedAppRepository } from '../repositories/allowed-app.repository';
import { NoteRepository } from '../repositories/note.repository';
import { SavedSiteRepository } from '../repositories/saved-site.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { ShortcutRepository } from '../repositories/shortcut.repository';
import { SliceRepository } from '../repositories/slice.repository';
import { SnippetRepository } from '../repositories/snippet.repository';
import { SuggestionRepository } from '../repositories/suggestion.repository';
import { seedFirstRun } from '../services/first-run';
import { NoteService } from '../services/note.service';
import { screenshotFiles } from '../services/saved-site-files';
import { SavedSiteService } from '../services/saved-site.service';
import { kindOfPath } from '../services/path-kind';
import { SettingsService } from '../services/settings.service';
import { ShortcutService } from '../services/shortcut.service';
import { SliceService } from '../services/slice.service';
import { SnippetService } from '../services/snippet.service';
import { SuggestionService } from '../services/suggestion.service';
import { setOpenKeys } from '../shortcuts/open-keys';
import type { Startup } from '../startup';
import {
  setBeforePieOpens,
  setPiePin,
  setPieSize,
} from '../windows/pie-window';
import {
  frontExplorerWindow,
  readExplorerSelection,
} from '../zip/explorer-selection';
import { ZipSelection, defaultZipDeps } from '../zip/zip-selection';
import { infoCardSettingsChanged } from '../windows/info-card-window';
import { sendNotesChanged } from '../windows/notes-window';
import {
  sendSavedSitesChangedToPageInfo,
  setCopiedAddressRule,
} from '../windows/page-info-window';
import { sendSavedSitesChanged } from '../windows/saved-sites-window';
import { showReminders } from '../windows/reminder-window';

// Opens the database and makes every service, wired to each other. Nothing
// is shown and no message is handled yet.
export function buildServices(startup: Startup) {
  const { db, isNew } = openDatabase(
    path.join(app.getPath('userData'), 'pie.db'),
  );
  startup.onQuit(() => db.close());
  const allowedApps = new AllowedAppRepository(db);
  const shortcutRepository = new ShortcutRepository(db);
  const sliceRepository = new SliceRepository(db);
  const slices = new SliceService(
    sliceRepository,
    allowedApps,
    kindOfPath,
    (target) => shell.openPath(target),
    (target) => shortcutRepository.findAppByTarget(target)?.label,
  );
  const shortcuts = new ShortcutService(
    shortcutRepository,
    allowedApps,
    kindOfPath,
    (target) => shell.openPath(target),
    (url) => shell.openExternal(url),
    (path) =>
      sliceRepository
        .findAll()
        .some((slice) => slice.type === 'app' && slice.path === path),
  );
  const snippets = new SnippetService(new SnippetRepository(db), (text) =>
    clipboard.writeText(text),
  );
  const notes = new NoteService(new NoteRepository(db));
  const reminders = new ReminderScheduler(notes, showReminders);
  startup.onQuit(() => reminders.stop());
  notes.onChanged((kind) => {
    // A new title or text doesn't move any reminder.
    if (kind !== 'text') {
      reminders.refresh();
    }
    sendNotesChanged();
  });
  // Saved screenshots sit beside the database, one file per saved site.
  const savedSites = new SavedSiteService(
    new SavedSiteRepository(db),
    screenshotFiles(path.join(app.getPath('userData'), 'saved-sites')),
  );
  savedSites.onChanged(() => {
    sendSavedSitesChanged();
    sendSavedSitesChangedToPageInfo();
  });
  const settingsRepository = new SettingsRepository(db);
  const settings = new SettingsService(settingsRepository, {
    useOpenKeys: setOpenKeys,
    applied: (saved) => {
      setPieSize(saved.size);
      setPiePin(saved.pin);
      infoCardSettingsChanged();
      // Defined below; only called once the app is running.
      suggestionSync.push();
    },
  });
  // A copied address is checked only if the Links list would offer it.
  setCopiedAddressRule((address) =>
    canOpen(address, readLinkFilter(settings.get().linkFilter)),
  );
  const pairing = new PairingCode(settingsRepository, {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (data) => safeStorage.decryptString(data),
  });
  const chromeBridge = startChromeBridge(pairing);
  startup.onQuit(() => void chromeBridge.stop());
  const suggestions = new SuggestionService(new SuggestionRepository(db));
  const suggestionSync = new SuggestionSync({
    list: () => suggestions.list(),
    isEnabled: () => settings.get().suggestionsInChrome === 'on',
    bridge: chromeBridge,
  });
  suggestions.onChanged(() => suggestionSync.push());
  const zipSelection = new ZipSelection({
    ...defaultZipDeps,
    frontExplorerWindow,
    readSelection: readExplorerSelection,
    announce: (zipFile, count) => {
      if (!Notification.isSupported()) {
        return;
      }
      const notice = new Notification({
        title: 'Zip saved',
        body: `${count} ${count === 1 ? 'image' : 'images'} in ${path.basename(zipFile)}. Click to show it.`,
        silent: true,
      });
      notice.on('click', () => shell.showItemInFolder(zipFile));
      notice.show();
    },
  });
  setBeforePieOpens(() => zipSelection.noteFrontWindow());

  if (isNew) {
    seedFirstRun(settings);
  }

  return {
    isNew,
    slices,
    shortcuts,
    snippets,
    notes,
    savedSites,
    reminders,
    settings,
    pairing,
    chromeBridge,
    suggestions,
    zipSelection,
  };
}

export type Services = ReturnType<typeof buildServices>;
