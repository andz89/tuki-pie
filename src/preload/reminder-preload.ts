import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { ReminderBridge } from '../shared/types';

const bridge: ReminderBridge = {
  list: () => ipcRenderer.invoke(IpcChannels.reminderList),
  open: (id) => ipcRenderer.invoke(IpcChannels.reminderOpen, id),
  snooze: (id) => ipcRenderer.invoke(IpcChannels.reminderSnooze, id),
  done: (id) => ipcRenderer.invoke(IpcChannels.reminderDone, id),
  fit: (height) => ipcRenderer.invoke(IpcChannels.reminderFit, height),
  onUpdate: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(IpcChannels.reminderUpdate, handler);
    return () =>
      ipcRenderer.removeListener(IpcChannels.reminderUpdate, handler);
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  },
};

contextBridge.exposeInMainWorld('reminder', bridge);
