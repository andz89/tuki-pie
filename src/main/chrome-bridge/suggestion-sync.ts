import { toChromeSuggestions } from '../../shared/suggestions';
import type { ChromeStatus, SuggestionGroup } from '../../shared/types';
import type { ChromeBridge } from './chrome-bridge';

interface SuggestionSyncOptions {
  list: () => SuggestionGroup[];
  isEnabled: () => boolean;
  bridge: Pick<ChromeBridge, 'status' | 'onStatus' | 'request'>;
}

// Keeps the Pie extension's copy of the suggestions current. Nothing is
// queued while Chrome is away: every connect sends the whole list again.
export class SuggestionSync {
  constructor(private readonly options: SuggestionSyncOptions) {
    options.bridge.onStatus((status: ChromeStatus) => {
      if (status === 'connected') {
        this.push();
      }
    });
  }

  push(): void {
    const { list, isEnabled, bridge } = this.options;
    if (bridge.status() !== 'connected') {
      return;
    }
    const suggestions = toChromeSuggestions(list(), isEnabled());
    // A send that fails is sent again on the next connect.
    bridge.request('setSuggestions', { ...suggestions }).catch(() => undefined);
  }
}
