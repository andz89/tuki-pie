import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  MAX_SNIPPETS,
  NewSnippet,
  Snippet,
  SnippetEdit,
} from '../../shared/schemas/snippet.schema';
import type { SnippetService } from '../services/snippet.service';
import { handle } from './handle';

const Id = Snippet.shape.id;

export function registerSnippetIpc(snippets: SnippetService): void {
  handle(IpcChannels.snippetsList, z.tuple([]), () => snippets.list());

  // Takes an id, never text: the text comes from the database.
  handle(IpcChannels.snippetsCopy, z.tuple([Id]), (id) => snippets.copy(id));

  handle(IpcChannels.panelSnippetAdd, z.tuple([NewSnippet]), (item) =>
    snippets.add(item),
  );

  handle(IpcChannels.panelSnippetUpdate, z.tuple([SnippetEdit]), (edit) =>
    snippets.update(edit),
  );

  handle(IpcChannels.panelSnippetRemove, z.tuple([Id]), (id) =>
    snippets.remove(id),
  );

  handle(
    IpcChannels.panelSnippetsReorder,
    z.tuple([Id.array().max(MAX_SNIPPETS)]),
    (ids) => snippets.reorder(ids),
  );
}
