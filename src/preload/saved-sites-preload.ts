import { contextBridge } from 'electron';
import { savedSitesBridge } from './saved-sites-api';

contextBridge.exposeInMainWorld('savedSites', savedSitesBridge);
