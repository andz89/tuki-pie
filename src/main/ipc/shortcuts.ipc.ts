import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  MAX_APPS,
  MAX_SHORTCUTS_PER_ROW,
  NewShortcut,
  Shortcut,
  ShortcutEdit,
} from '../../shared/schemas/shortcut.schema';
import type { ShortcutService } from '../services/shortcut.service';
import { takePanelFormRequest } from '../windows/panel-window';
import { handle } from './handle';

const Id = Shortcut.shape.id;
// The longest row: apps fan out further than links and groups. The service
// checks the exact row, this only bounds the message.
const MAX_ROW = Math.max(MAX_APPS, MAX_SHORTCUTS_PER_ROW);

// `iconOf` reads an app shortcut's icon by its id; see shortcut-icon.ts.
export function registerShortcutIpc(
  shortcuts: ShortcutService,
  iconOf: (id: string) => Promise<string | null>,
): void {
  handle(IpcChannels.shortcutsList, z.tuple([]), () => shortcuts.list());

  // Takes an id, never an address: the address comes from the database.
  handle(IpcChannels.shortcutsOpen, z.tuple([Id]), (id) => shortcuts.open(id));

  handle(IpcChannels.shortcutsIcon, z.tuple([Id]), (id) => iconOf(id));

  handle(IpcChannels.panelShortcutAdd, z.tuple([NewShortcut]), (item) =>
    shortcuts.addApproved(item),
  );

  handle(IpcChannels.panelShortcutUpdate, z.tuple([ShortcutEdit]), (edit) =>
    shortcuts.updateApproved(edit),
  );

  handle(IpcChannels.panelShortcutRemove, z.tuple([Id]), (id) =>
    shortcuts.remove(id),
  );

  handle(
    IpcChannels.panelShortcutsReorder,
    z.tuple([Id.nullable(), Id.array().max(MAX_ROW)]),
    (parentId, ids) => shortcuts.reorder(parentId, ids),
  );

  handle(
    IpcChannels.panelShortcutMove,
    z.tuple([
      Id,
      Id.nullable(),
      z
        .number()
        .int()
        .min(0)
        .max(MAX_SHORTCUTS_PER_ROW - 1),
    ]),
    (id, parentId, index) => shortcuts.move(id, parentId, index),
  );

  handle(IpcChannels.panelTakeFormRequest, z.tuple([]), takePanelFormRequest);
}
