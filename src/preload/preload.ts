import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { PieBridge, PiePhase } from '../shared/types';

const bridge: PieBridge = {
  slices: {
    list: () => ipcRenderer.invoke(IpcChannels.slicesList),
    open: (id) => ipcRenderer.invoke(IpcChannels.slicesOpen, id),
  },
  shortcuts: {
    list: () => ipcRenderer.invoke(IpcChannels.shortcutsList),
    open: (id) => ipcRenderer.invoke(IpcChannels.shortcutsOpen, id),
    icon: (id) => ipcRenderer.invoke(IpcChannels.shortcutsIcon, id),
  },
  snippets: {
    list: () => ipcRenderer.invoke(IpcChannels.snippetsList),
    copy: (id) => ipcRenderer.invoke(IpcChannels.snippetsCopy, id),
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    update: (changes) =>
      ipcRenderer.invoke(IpcChannels.settingsUpdate, changes),
  },
  screenshot: {
    take: (mode) => ipcRenderer.invoke(IpcChannels.screenshotTake, mode),
  },
  zip: {
    count: () => ipcRenderer.invoke(IpcChannels.zipCount),
    create: (name) => ipcRenderer.invoke(IpcChannels.zipCreate, name),
  },
  window: {
    openShortcutForm: (request) =>
      ipcRenderer.invoke(IpcChannels.windowOpenShortcutForm, request),
    hide: () => ipcRenderer.invoke(IpcChannels.windowHide),
    dismiss: () => ipcRenderer.invoke(IpcChannels.windowDismiss),
    onPhase: (listener) => {
      const handler = (_event: unknown, phase: PiePhase) => listener(phase);
      ipcRenderer.on(IpcChannels.windowPhase, handler);
      return () => ipcRenderer.removeListener(IpcChannels.windowPhase, handler);
    },
    moveBy: (deltaX, deltaY) =>
      ipcRenderer.invoke(IpcChannels.windowMoveBy, deltaX, deltaY),
    openSettings: () => ipcRenderer.invoke(IpcChannels.windowOpenSettings),
    openPageInfo: () => ipcRenderer.invoke(IpcChannels.windowOpenPageInfo),
    openNotes: () => ipcRenderer.invoke(IpcChannels.windowOpenNotes),
    volume: (change) => ipcRenderer.invoke(IpcChannels.windowVolume, change),
    setListSide: (side) =>
      ipcRenderer.invoke(IpcChannels.windowSetListSide, side),
  },
};

contextBridge.exposeInMainWorld('pie', bridge);
