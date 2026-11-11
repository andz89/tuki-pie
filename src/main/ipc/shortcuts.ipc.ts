import { app, nativeImage, shell } from 'electron';
import path from 'node:path';
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
import type { SliceService } from '../services/slice.service';
import { readAppIcon } from '../shortcuts/app-icon';
import { cachedIconReader } from '../shortcuts/icon-cache';
import { shellIconOf } from '../shortcuts/shell-icon';
import { takePanelFormRequest } from '../windows/panel-window';
import { handle } from './handle';

const Id = Shortcut.shape.id;
// The longest row: apps fan out further than links and groups. The service
// checks the exact row, this only bounds the message.
const MAX_ROW = Math.max(MAX_APPS, MAX_SHORTCUTS_PER_ROW);

export function registerShortcutIpc(
  shortcuts: ShortcutService,
  slices: SliceService,
): void {
  // Store-app icons take a PowerShell each: one at a time, kept on disk.
  const shellIcon = cachedIconReader(
    shellIconOf,
    path.join(app.getPath('userData'), 'icon-cache'),
  );

  handle(IpcChannels.shortcutsList, z.tuple([]), () => shortcuts.list());

  // Takes an id, never an address: the address comes from the database.
  handle(IpcChannels.shortcutsOpen, z.tuple([Id]), (id) => shortcuts.open(id));

  // Read from the saved app's file, so the donut can't ask about any other.
  handle(IpcChannels.shortcutsIcon, z.tuple([Id]), async (id) => {
    const shortcut = shortcuts.find(id);
    if (shortcut?.type !== 'app' || !shortcut.target) {
      return null;
    }
    return readAppIcon(shortcut.target, {
      readLink: (path) => shell.readShortcutLink(path),
      imageOf: async (path) => {
        const image = nativeImage.createFromPath(path);
        return image.isEmpty() ? null : image.toDataURL();
      },
      iconOf: async (path) => {
        const icon = await app.getFileIcon(path, { size: 'large' });
        return icon.isEmpty() ? null : icon.toDataURL();
      },
      shellIconOf: shellIcon,
    });
  });

  // The add and update messages only come from the settings window, so saving
  // an app there counts as the person approving it.
  handle(IpcChannels.panelShortcutAdd, z.tuple([NewShortcut]), (item) => {
    shortcuts.assertCanAdd(item);
    if (item.type === 'app' || item.type === 'path') {
      slices.allowApp(item.target);
    }
    return shortcuts.add(item);
  });

  handle(IpcChannels.panelShortcutUpdate, z.tuple([ShortcutEdit]), (edit) => {
    shortcuts.assertCanUpdate(edit);
    const type = shortcuts.find(edit.id)?.type;
    if ((type === 'app' || type === 'path') && edit.target !== null) {
      slices.allowApp(edit.target);
    }
    return shortcuts.update(edit);
  });

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
