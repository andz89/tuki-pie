import { CHANNEL_ROLES, setWindowRole } from './ipc-access';
import type { WindowRole } from './ipc-access';

// For tests: an event as the main frame of a window with this role sends it.
export function eventFrom(role: WindowRole) {
  const mainFrame = {};
  const sender = { mainFrame };
  setWindowRole(sender as never, role);
  return { sender, senderFrame: mainFrame };
}

// For tests: an event from the first window allowed to send on `channel`.
export function eventFor(channel: string) {
  const role = CHANNEL_ROLES[channel]?.[0];
  if (!role) {
    throw new Error(`${channel} has no rule in ipc-access.ts.`);
  }
  return eventFrom(role);
}
