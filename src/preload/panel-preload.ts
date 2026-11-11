import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { ChromeStatus, PanelBridge } from '../shared/types';

// Only the settings window gets this bridge. The donut's bridge can't change anything.
const bridge: PanelBridge = {
  shortcuts: {
    list: () => ipcRenderer.invoke(IpcChannels.shortcutsList),
    add: (item) => ipcRenderer.invoke(IpcChannels.panelShortcutAdd, item),
    update: (edit) => ipcRenderer.invoke(IpcChannels.panelShortcutUpdate, edit),
    remove: (id) => ipcRenderer.invoke(IpcChannels.panelShortcutRemove, id),
    reorder: (parentId, ids) =>
      ipcRenderer.invoke(IpcChannels.panelShortcutsReorder, parentId, ids),
    move: (id, parentId, index) =>
      ipcRenderer.invoke(IpcChannels.panelShortcutMove, id, parentId, index),
  },
  snippets: {
    list: () => ipcRenderer.invoke(IpcChannels.snippetsList),
    add: (item) => ipcRenderer.invoke(IpcChannels.panelSnippetAdd, item),
    update: (edit) => ipcRenderer.invoke(IpcChannels.panelSnippetUpdate, edit),
    remove: (id) => ipcRenderer.invoke(IpcChannels.panelSnippetRemove, id),
    reorder: (ids) => ipcRenderer.invoke(IpcChannels.panelSnippetsReorder, ids),
  },
  suggestions: {
    list: () => ipcRenderer.invoke(IpcChannels.panelSuggestionsList),
    change: (change) =>
      ipcRenderer.invoke(IpcChannels.panelSuggestionsChange, change),
  },
  takeFormRequest: () => ipcRenderer.invoke(IpcChannels.panelTakeFormRequest),
  onFormRequested: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(IpcChannels.panelFormRequested, handler);
    return () =>
      ipcRenderer.removeListener(IpcChannels.panelFormRequested, handler);
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    update: (changes) =>
      ipcRenderer.invoke(IpcChannels.settingsUpdate, changes),
  },
  allowedApps: {
    list: () => ipcRenderer.invoke(IpcChannels.panelAllowedAppsList),
    remove: (path) =>
      ipcRenderer.invoke(IpcChannels.panelAllowedAppRemove, path),
  },
  pickPath: (type) => ipcRenderer.invoke(IpcChannels.panelPickPath, type),
  chrome: {
    get: () => ipcRenderer.invoke(IpcChannels.panelChromeGet),
    newCode: () => ipcRenderer.invoke(IpcChannels.panelChromeNewCode),
    copyCode: () => ipcRenderer.invoke(IpcChannels.panelChromeCopyCode),
    onStatus: (listener) => {
      const handler = (_event: unknown, status: ChromeStatus) =>
        listener(status);
      ipcRenderer.on(IpcChannels.panelChromeStatus, handler);
      return () =>
        ipcRenderer.removeListener(IpcChannels.panelChromeStatus, handler);
    },
  },
};

contextBridge.exposeInMainWorld('piePanel', bridge);
