import { ipcMain } from 'electron';
import type { z } from 'zod';
import type { Result } from '../../shared/types';
import { UserError } from '../services/user-error';

// Registers a request handler that checks its input first. Anything that fails
// the check is rejected before any work happens.
export function handle<Args extends unknown[], Value>(
  channel: string,
  input: z.ZodType<Args>,
  run: (...args: Args) => Value | Promise<Value>,
): void {
  ipcMain.handle(
    channel,
    async (_event, ...raw: unknown[]): Promise<Result<Value>> => {
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
