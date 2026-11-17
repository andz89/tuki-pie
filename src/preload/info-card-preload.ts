import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { InfoCardBridge, InfoCardState } from '../shared/types';

const infoCardBridge: InfoCardBridge = {
  getState: () => ipcRenderer.invoke(IpcChannels.infoCardGetState),
  setPinned: (pinned) =>
    ipcRenderer.invoke(IpcChannels.infoCardSetPinned, pinned),
  setLayout: (layout) =>
    ipcRenderer.invoke(IpcChannels.infoCardSetLayout, layout),
  setFields: (fields) =>
    ipcRenderer.invoke(IpcChannels.infoCardSetFields, fields),
  image: (url, size) =>
    ipcRenderer.invoke(IpcChannels.infoCardImage, url, size),
  close: () => ipcRenderer.invoke(IpcChannels.infoCardClose),
  openInWebPage: () => ipcRenderer.invoke(IpcChannels.infoCardOpenInWebPage),
  setView: (view) => ipcRenderer.invoke(IpcChannels.infoCardSetView, view),
  showLink: (index, href) =>
    ipcRenderer.invoke(IpcChannels.infoCardShowLink, index, href),
  openLinks: (urls, ticked) =>
    ipcRenderer.invoke(IpcChannels.infoCardOpenLinks, urls, ticked),
  openHere: (href, ticked) =>
    ipcRenderer.invoke(IpcChannels.infoCardOpenHere, href, ticked),
  setLinkFilter: (filter) =>
    ipcRenderer.invoke(IpcChannels.infoCardSetLinkFilter, filter),
  setLinksOpenIn: (openIn) =>
    ipcRenderer.invoke(IpcChannels.infoCardSetLinksOpenIn, openIn),
  highlight: (text) => ipcRenderer.invoke(IpcChannels.infoCardHighlight, text),
  onUpdate: (listener) => {
    const handler = (_event: unknown, state: InfoCardState) => listener(state);
    ipcRenderer.on(IpcChannels.infoCardUpdate, handler);
    return () =>
      ipcRenderer.removeListener(IpcChannels.infoCardUpdate, handler);
  },
};

contextBridge.exposeInMainWorld('infoCard', infoCardBridge);
