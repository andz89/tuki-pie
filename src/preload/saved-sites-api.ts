import { ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { SavedSitesBridge } from '../shared/types';

// Shared by the Saved sites window and the Page Info window, which can show
// the same list in place of its tabs.
export const savedSitesBridge: SavedSitesBridge = {
  list: () => ipcRenderer.invoke(IpcChannels.savedSitesList),
  get: (id) => ipcRenderer.invoke(IpcChannels.savedSitesGet, id),
  setNote: (id, note) =>
    ipcRenderer.invoke(IpcChannels.savedSitesSetNote, id, note),
  remove: (id) => ipcRenderer.invoke(IpcChannels.savedSitesRemove, id),
  openLive: (id) => ipcRenderer.invoke(IpcChannels.savedSitesOpenLive, id),
  screenshot: (id) => ipcRenderer.invoke(IpcChannels.savedSitesScreenshot, id),
  saveScreenshot: (id) =>
    ipcRenderer.invoke(IpcChannels.savedSitesSaveScreenshot, id),
  copyScreenshot: (id) =>
    ipcRenderer.invoke(IpcChannels.savedSitesCopyScreenshot, id),
  onChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(IpcChannels.savedSitesChanged, handler);
    return () =>
      ipcRenderer.removeListener(IpcChannels.savedSitesChanged, handler);
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  },
};
