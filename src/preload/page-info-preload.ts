import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { PageInfoBridge, PageInfoUpdate } from '../shared/types';

const bridge: PageInfoBridge = {
  getState: () => ipcRenderer.invoke(IpcChannels.pageInfoGetState),
  check: (address) => ipcRenderer.invoke(IpcChannels.pageInfoCheck, address),
  refresh: () => ipcRenderer.invoke(IpcChannels.pageInfoRefresh),
  setSiteVisible: (visible) =>
    ipcRenderer.invoke(IpcChannels.pageInfoSetSiteVisible, visible),
  goToTab: () => ipcRenderer.invoke(IpcChannels.pageInfoGoToTab),
  showLink: (index, href) =>
    ipcRenderer.invoke(IpcChannels.pageInfoShowLink, index, href),
  openLinks: (urls, ticked) =>
    ipcRenderer.invoke(IpcChannels.pageInfoOpenLinks, urls, ticked ?? []),
  setOnTop: (onTop) => ipcRenderer.invoke(IpcChannels.pageInfoSetOnTop, onTop),
  setLinkFilter: (filter) =>
    ipcRenderer.invoke(IpcChannels.pageInfoSetLinkFilter, filter),
  capture: (size) => ipcRenderer.invoke(IpcChannels.pageInfoCapture, size),
  saveCapture: () => ipcRenderer.invoke(IpcChannels.pageInfoSaveCapture),
  copyCapture: () => ipcRenderer.invoke(IpcChannels.pageInfoCopyCapture),
  image: (url, size) =>
    ipcRenderer.invoke(IpcChannels.pageInfoImage, url, size),
  onUpdate: (listener) => {
    const handler = (_event: unknown, update: PageInfoUpdate) =>
      listener(update);
    ipcRenderer.on(IpcChannels.pageInfoUpdate, handler);
    return () =>
      ipcRenderer.removeListener(IpcChannels.pageInfoUpdate, handler);
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  },
};

contextBridge.exposeInMainWorld('pageInfo', bridge);
