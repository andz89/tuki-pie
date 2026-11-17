import { HistoryAnswer } from '../../shared/schemas/history.schema';
import type {
  HistoryMatch,
  HistoryVisit,
} from '../../shared/schemas/history.schema';
import { UserError } from '../services/user-error';
import type { ChromeBridge } from './chrome-bridge';

export const NOT_CONNECTED = 'Chrome is not connected.';
export const COULD_NOT_READ =
  'Could not read Chrome history. If the Pie extension was just updated, reload it in chrome://extensions.';

// A long range can mean thousands of visits for Chrome to read.
export const HISTORY_MS = 20000;

// Pages visited in Chrome, read by the extension. Its answer is checked like
// anything else that comes from outside.
export async function searchChromeHistory(
  bridge: Pick<ChromeBridge, 'request' | 'status'> | null,
  text: string,
  days: number,
  match: HistoryMatch,
): Promise<HistoryVisit[]> {
  if (bridge?.status() !== 'connected') {
    throw new UserError(NOT_CONNECTED);
  }
  const answer = await bridge
    .request('history', { text, days, match }, HISTORY_MS)
    .catch(() => {
      throw new UserError(COULD_NOT_READ);
    });
  // An extension from before this setting answers with a bare list, and
  // would have ignored the match asked for.
  const checked = HistoryAnswer.safeParse(answer);
  if (!checked.success || checked.data.match !== match) {
    throw new UserError(COULD_NOT_READ);
  }
  return checked.data.visits;
}
