import type { PageInfoBridge } from '../../shared/types';

declare global {
  interface Window {
    pageInfo: PageInfoBridge;
  }
}

export const pageInfoBridge: PageInfoBridge = window.pageInfo;
