import type { InfoCardBridge } from '../../shared/types';

declare global {
  interface Window {
    infoCard: InfoCardBridge;
  }
}

export const infoCardBridge: InfoCardBridge = window.infoCard;
