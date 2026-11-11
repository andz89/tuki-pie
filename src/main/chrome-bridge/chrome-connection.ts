import { ChromeBridge } from './chrome-bridge';
import type { PairingCode } from './pairing-code';

// One connection for the whole app, started with it, so the status is known
// before Page Info opens.
let bridge: ChromeBridge | null = null;

export function startChromeBridge(pairing: PairingCode): ChromeBridge {
  bridge = new ChromeBridge({ getCode: () => pairing.get() });
  void bridge.start();
  return bridge;
}

export function getChromeBridge(): ChromeBridge | null {
  return bridge;
}
