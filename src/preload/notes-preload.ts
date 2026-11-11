import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { NotesBridge } from '../shared/types';

function listen(channel: string, listener: () => void): () => void {
  const handler = () => listener();
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const bridge: NotesBridge = {
  list: (cleanUp) => ipcRenderer.invoke(IpcChannels.notesList, cleanUp),
  create: (item) => ipcRenderer.invoke(IpcChannels.notesCreate, item),
  update: (edit) => ipcRenderer.invoke(IpcChannels.notesUpdate, edit),
  remove: (id) => ipcRenderer.invoke(IpcChannels.notesRemove, id),
  setReminder: (id, reminder) =>
    ipcRenderer.invoke(IpcChannels.notesSetReminder, id, reminder),
  takeRequest: () => ipcRenderer.invoke(IpcChannels.notesTakeRequest),
  onChanged: (listener) => listen(IpcChannels.notesChanged, listener),
  onOpenRequested: (listener) =>
    listen(IpcChannels.notesOpenRequested, listener),
  onSaveRequested: (save) =>
    listen(IpcChannels.notesSaveRequested, () => {
      void save()
        .catch(() => undefined)
        .then(() => ipcRenderer.send(IpcChannels.notesSaved));
    }),
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  },
};

contextBridge.exposeInMainWorld('notes', bridge);
