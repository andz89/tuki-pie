import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';
import { IpcChannels as C } from '../../shared/ipc-channels';

// Each window with a preload, by what it is for.
export type WindowRole =
  | 'pie'
  | 'panel'
  | 'notes'
  | 'page-info'
  | 'saved-sites'
  | 'reminder'
  | 'screenshot';

const roles = new WeakMap<WebContents, WindowRole>();

// Called once as each window is made.
export function setWindowRole(contents: WebContents, role: WindowRole): void {
  roles.set(contents, role);
}

// Whether this is one of the app's own windows, not a site.
export function hasWindowRole(contents: WebContents): boolean {
  return roles.has(contents);
}

const SETTINGS_READERS: WindowRole[] = [
  'pie',
  'panel',
  'notes',
  'page-info',
  'saved-sites',
  'reminder',
];

// Page Info can show the saved list in place of its tabs.
const SAVED_SITES_VIEWS: WindowRole[] = ['page-info', 'saved-sites'];

// Which windows may send each message. Kept to what each preload's bridge
// calls (ipc-access.test.ts checks that), so a script that got into one
// window still can't reach another window's channels. A channel left out
// here is refused for everyone.
export const CHANNEL_ROLES: Readonly<Record<string, readonly WindowRole[]>> = {
  [C.windowHide]: ['pie'],
  [C.windowDismiss]: ['pie'],
  [C.windowMoveBy]: ['pie'],
  [C.windowOpenSettings]: ['pie'],
  [C.windowVolume]: ['pie'],
  [C.windowOpenShortcutForm]: ['pie'],
  [C.windowOpenPageInfo]: ['pie'],
  [C.windowSetListSide]: ['pie'],
  [C.windowOpenNotes]: ['pie'],
  [C.pieSettingsUpdate]: ['pie'],
  [C.shortcutsOpen]: ['pie'],
  [C.shortcutsIcon]: ['pie'],
  [C.snippetsCopy]: ['pie'],
  [C.screenshotTake]: ['pie'],
  [C.zipCount]: ['pie'],
  [C.zipCreate]: ['pie'],
  [C.shortcutsList]: ['pie', 'panel'],
  [C.snippetsList]: ['pie', 'panel'],
  [C.settingsGet]: SETTINGS_READERS,

  [C.settingsUpdate]: ['panel'],
  [C.panelShortcutAdd]: ['panel'],
  [C.panelShortcutUpdate]: ['panel'],
  [C.panelShortcutRemove]: ['panel'],
  [C.panelShortcutsReorder]: ['panel'],
  [C.panelShortcutMove]: ['panel'],
  [C.panelTakeFormRequest]: ['panel'],
  [C.panelSnippetAdd]: ['panel'],
  [C.panelSnippetUpdate]: ['panel'],
  [C.panelSnippetRemove]: ['panel'],
  [C.panelSnippetsReorder]: ['panel'],
  [C.panelSuggestionsList]: ['panel'],
  [C.panelSuggestionsChange]: ['panel'],
  [C.panelAllowedAppsList]: ['panel'],
  [C.panelAllowedAppRemove]: ['panel'],
  [C.panelPickPath]: ['panel'],
  [C.panelChromeGet]: ['panel'],
  [C.panelChromeNewCode]: ['panel'],
  [C.panelChromeCopyCode]: ['panel'],

  [C.notesList]: ['notes'],
  [C.notesCreate]: ['notes'],
  [C.notesUpdate]: ['notes'],
  [C.notesRemove]: ['notes'],
  [C.notesSetReminder]: ['notes'],
  [C.notesTakeRequest]: ['notes'],

  [C.pageInfoGetState]: ['page-info'],
  [C.pageInfoGetTabs]: ['page-info'],
  [C.pageInfoNewTab]: ['page-info'],
  [C.pageInfoCloseTab]: ['page-info'],
  [C.pageInfoSwitchTab]: ['page-info'],
  [C.pageInfoCheck]: ['page-info'],
  [C.pageInfoRefresh]: ['page-info'],
  [C.pageInfoSetSiteVisible]: ['page-info'],
  [C.pageInfoGoToTab]: ['page-info'],
  [C.pageInfoShowLink]: ['page-info'],
  [C.pageInfoOpenLinks]: ['page-info'],
  [C.pageInfoSetLinkFilter]: ['page-info'],
  [C.pageInfoSetOnTop]: ['page-info'],
  [C.pageInfoCapture]: ['page-info'],
  [C.pageInfoSaveCapture]: ['page-info'],
  [C.pageInfoCopyCapture]: ['page-info'],
  [C.pageInfoImage]: ['page-info'],

  [C.savedSitesList]: SAVED_SITES_VIEWS,
  [C.savedSitesGet]: SAVED_SITES_VIEWS,
  [C.savedSitesSetNote]: SAVED_SITES_VIEWS,
  [C.savedSitesRemove]: SAVED_SITES_VIEWS,
  [C.savedSitesOpenLive]: SAVED_SITES_VIEWS,
  [C.savedSitesScreenshot]: SAVED_SITES_VIEWS,
  [C.savedSitesSaveScreenshot]: SAVED_SITES_VIEWS,
  [C.savedSitesCopyScreenshot]: SAVED_SITES_VIEWS,
  [C.savedSitesSave]: ['page-info'],
  [C.savedSitesOpenWindow]: ['page-info'],

  [C.reminderList]: ['reminder'],
  [C.reminderOpen]: ['reminder'],
  [C.reminderSnooze]: ['reminder'],
  [C.reminderDone]: ['reminder'],
  [C.reminderFit]: ['reminder'],

  [C.screenshotImage]: ['screenshot'],
  [C.screenshotPick]: ['screenshot'],
  [C.screenshotCancel]: ['screenshot'],
};

export function hasChannelRule(channel: string): boolean {
  return channel in CHANNEL_ROLES;
}

// Throws unless the message came from the main frame of a window allowed to
// send it.
export function assertSender(
  channel: string,
  event: Pick<IpcMainInvokeEvent | IpcMainEvent, 'sender' | 'senderFrame'>,
): void {
  const role = roles.get(event.sender);
  const isMainFrame =
    event.senderFrame !== null && event.senderFrame === event.sender.mainFrame;
  if (!role || !isMainFrame || !CHANNEL_ROLES[channel]?.includes(role)) {
    throw new Error(`${channel} is not allowed from this window.`);
  }
}
