import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { SuggestionChange } from '../../shared/schemas/suggestion.schema';
import type { SuggestionService } from '../services/suggestion.service';
import { handle } from './handle';

export function registerSuggestionIpc(suggestions: SuggestionService): void {
  handle(IpcChannels.panelSuggestionsList, z.tuple([]), () =>
    suggestions.list(),
  );

  handle(
    IpcChannels.panelSuggestionsChange,
    z.tuple([SuggestionChange]),
    (change) => suggestions.apply(change),
  );
}
