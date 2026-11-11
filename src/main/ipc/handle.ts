import { ipcMain } from 'electron';
import type { z } from 'zod';
import type { Result } from '../../shared/types';
import { UserError } from '../services/user-error';
import { assertSender, hasChannelRule } from './ipc-access';

// Registers a request handler that checks who sent it and its input first.
// Anything that fails either check is rejected before any work happens.
export function handle<Args extends unknown[], Value>(
  channel: string,
  input: z.ZodType<Args>,
  run: (...args: Args) => Value | Promise<Value>,
): void {
  // A channel no window may use would be refused every time, so say so now.
  if (!hasChannelRule(channel)) {
    throw new Error(`${channel} has no rule in ipc-access.ts.`);
  }
  ipcMain.handle(
    channel,
    async (event, ...raw: unknown[]): Promise<Result<Value>> => {
      assertSender(channel, event);
      const args = input.parse(raw);
      try {
        return { ok: true, value: await run(...args) };
      } catch (error) {
        if (error instanceof UserError) {
          return { ok: false, error: error.message };
        }
        throw error;
      }
    },
  );
}
