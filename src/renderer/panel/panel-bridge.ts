import type { PanelBridge } from '../../shared/types';

declare global {
  interface Window {
    piePanel: PanelBridge;
  }
}

export const panelBridge: PanelBridge = window.piePanel;
