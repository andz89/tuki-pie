import { clipboard } from 'electron';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import type { ChromePairing } from '../../shared/types';
import type { ChromeBridge } from '../chrome-bridge/chrome-bridge';
import type { PairingCode } from '../chrome-bridge/pairing-code';
import { getPanelWindow } from '../windows/panel-window';
import { handle } from './handle';

type Bridge = Pick<ChromeBridge, 'status' | 'onStatus' | 'dropConnection'>;

// Only the settings window's bridge has these messages, so the pairing code
// never reaches Page Info or the donut.
export function registerChromeIpc(pairing: PairingCode, bridge: Bridge): void {
  const current = (): ChromePairing => ({
    status: bridge.status(),
    code: pairing.get(),
  });

  handle(IpcChannels.panelChromeGet, z.tuple([]), current);

  // The old code stops working at once.
  handle(IpcChannels.panelChromeNewCode, z.tuple([]), () => {
    pairing.renew();
    bridge.dropConnection();
    return current();
  });

  handle(IpcChannels.panelChromeCopyCode, z.tuple([]), () => {
    clipboard.writeText(pairing.get());
  });

  bridge.onStatus((status) => {
    getPanelWindow()?.webContents.send(IpcChannels.panelChromeStatus, status);
  });
}
