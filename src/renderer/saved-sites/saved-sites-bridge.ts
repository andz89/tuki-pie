import type { SavedSitesBridge } from '../../shared/types';

declare global {
  interface Window {
    savedSites: SavedSitesBridge;
  }
}

export const savedSitesBridge: SavedSitesBridge = window.savedSites;
