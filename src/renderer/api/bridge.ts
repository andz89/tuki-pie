import type { PieBridge } from '../../shared/types';

declare global {
  interface Window {
    pie: PieBridge;
  }
}

export const bridge: PieBridge = window.pie;
