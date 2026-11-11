import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { ScreenshotBridge } from '../shared/types';

const bridge: ScreenshotBridge = {
  image: () => ipcRenderer.invoke(IpcChannels.screenshotImage),
  pick: (area) => ipcRenderer.invoke(IpcChannels.screenshotPick, area),
  cancel: () => ipcRenderer.invoke(IpcChannels.screenshotCancel),
};

contextBridge.exposeInMainWorld('screenshot', bridge);
