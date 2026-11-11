import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  MAX_APPS,
  MAX_SHORTCUTS_PER_ROW,
  isWebLink,
} from '../../shared/schemas/shortcut.schema';
import type {
  NewShortcut,
  Shortcut,
  ShortcutEdit,
  ShortcutType,
} from '../../shared/types';
import type { AllowedAppRepository } from '../repositories/allowed-app.repository';
import type { ShortcutRepository } from '../repositories/shortcut.repository';
import type { PathKind } from './path-kind';
import { UserError } from './user-error';

const SHORTCUT_GONE = 'That shortcut no longer exists.';
const GROUP_GONE = 'That group no longer exists.';
const BAD_LINK = 'Links must start with http or https.';
const APP_NOT_ALLOWED = 'App not allowed. Check Settings.';
const NOT_A_FULL_PATH = 'Enter a full path, like C:\\Folder\\file.txt.';
const NOTHING_AT_PATH = 'Nothing found at that path.';
const APPS_APART = 'Apps live in the Apps tab, not in a group.';

export class ShortcutService {
  constructor(
    private readonly shortcuts: ShortcutRepository,
    private readonly allowedApps: AllowedAppRepository,
    private readonly kindOf: (path: string) => PathKind,
    private readonly openPath: (path: string) => Promise<string>,
    private readonly openExternal: (url: string) => Promise<void>,
    // Whether a donut slice still opens this app, so it stays allowed.
    private readonly isUsedBySlice: (path: string) => boolean = () => false,
  ) {}

  list(): Shortcut[] {
    return this.shortcuts.findAll();
  }

  find(id: string): Shortcut | null {
    return this.shortcuts.findById(id);
  }

  async open(id: string): Promise<void> {
    const shortcut = this.shortcuts.findById(id);
    if (!shortcut) {
      throw new UserError(SHORTCUT_GONE);
    }

    if (shortcut.type === 'link') {
      await this.openLink(shortcut);
    } else if (shortcut.type === 'app' || shortcut.type === 'path') {
      await this.openApp(shortcut);
    } else {
      throw new UserError('That shortcut cannot be opened.');
    }
  }

  // Everything except the allowed list, so a save that can't succeed never
  // gets as far as approving its path.
  assertCanAdd(item: NewShortcut): void {
    if (item.type === 'app' && item.parentId !== null) {
      throw new UserError(APPS_APART);
    }
    this.assertParentIsGroup(item.parentId);
    const limit = item.type === 'app' ? MAX_APPS : MAX_SHORTCUTS_PER_ROW;
    if (this.rowIds(item.parentId, item.type).length >= limit) {
      throw new UserError(
        item.type === 'app'
          ? `There is room for ${MAX_APPS} apps at most.`
          : `This row can hold ${MAX_SHORTCUTS_PER_ROW} shortcuts at most.`,
      );
    }
    this.assertTargetFits(item.type, item.target);
  }

  assertCanUpdate(edit: ShortcutEdit): void {
    this.assertTargetFits(this.existing(edit.id).type, edit.target);
  }

  add(item: NewShortcut): Shortcut[] {
    this.assertCanAdd(item);
    this.assertAllowed(item.type, item.target);
    this.shortcuts.insert({
      ...item,
      id: randomUUID(),
      position: this.rowIds(item.parentId, item.type).length,
    });
    return this.list();
  }

  update(edit: ShortcutEdit): Shortcut[] {
    this.assertCanUpdate(edit);
    const before = this.existing(edit.id);
    this.assertAllowed(before.type, edit.target);
    this.shortcuts.update(edit);
    if (before.target !== edit.target) {
      this.forgetUnused([before]);
    }
    return this.list();
  }

  remove(id: string): Shortcut[] {
    const shortcut = this.shortcuts.findById(id);
    if (!shortcut) {
      throw new UserError(SHORTCUT_GONE);
    }

    // A group takes what is inside it along.
    const gone = [
      shortcut,
      ...this.list().filter(({ parentId }) => parentId === id),
    ];
    this.shortcuts.removeAndRenumber(
      id,
      this.rowIds(shortcut.parentId, shortcut.type).filter(
        (other) => other !== id,
      ),
    );
    this.forgetUnused(gone);
    return this.list();
  }

  // Saving an app or path shortcut approves its target. Once no shortcut or
  // slice opens that target any more, the approval goes too, so the allowed
  // list doesn't keep growing.
  private forgetUnused(gone: Shortcut[]): void {
    const stillUsed = new Set(
      this.list()
        .filter(({ type }) => type === 'app' || type === 'path')
        .map(({ target }) => target),
    );
    for (const { type, target } of gone) {
      if (
        (type === 'app' || type === 'path') &&
        target !== null &&
        !stillUsed.has(target) &&
        !this.isUsedBySlice(target)
      ) {
        this.allowedApps.remove(target);
      }
    }
  }

  // Apps are ordered among themselves, links and groups among theirs.
  reorder(parentId: string | null, ids: string[]): Shortcut[] {
    const first = ids.length > 0 ? this.shortcuts.findById(ids[0]) : null;
    const current = new Set(this.rowIds(parentId, first?.type ?? 'link'));
    const isEveryItemOnce =
      ids.length === current.size &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.has(id));
    if (!isEveryItemOnce) {
      throw new UserError('The shortcuts changed. Please try again.');
    }

    this.shortcuts.setOrder(ids);
    return this.list();
  }

  // Puts a shortcut at a place in a row, which can be another row: the top
  // row, or inside a group. The index counts the row without the shortcut.
  move(id: string, parentId: string | null, index: number): Shortcut[] {
    const shortcut = this.existing(id);
    if (shortcut.type === 'app') {
      throw new UserError(APPS_APART);
    }
    if (shortcut.type === 'group' && parentId !== null) {
      throw new UserError('A group cannot go inside another group.');
    }
    this.assertParentIsGroup(parentId);

    const row = this.rowIds(parentId, shortcut.type).filter(
      (other) => other !== id,
    );
    const isNewRow = shortcut.parentId !== parentId;
    if (isNewRow && row.length >= MAX_SHORTCUTS_PER_ROW) {
      throw new UserError(
        `This row can hold ${MAX_SHORTCUTS_PER_ROW} shortcuts at most.`,
      );
    }
    row.splice(Math.min(Math.max(index, 0), row.length), 0, id);

    const oldRow = isNewRow
      ? this.rowIds(shortcut.parentId, shortcut.type).filter(
          (other) => other !== id,
        )
      : [];
    this.shortcuts.move(id, parentId, row, oldRow);
    return this.list();
  }

  // One row: the apps, or the links and groups in one place.
  private rowIds(parentId: string | null, type: ShortcutType): string[] {
    const isApp = type === 'app';
    return this.list()
      .filter(
        (shortcut) =>
          shortcut.parentId === parentId && (shortcut.type === 'app') === isApp,
      )
      .map((shortcut) => shortcut.id);
  }

  // Checked on every open, so a changed database can't launch something else.
  private async openLink({ label, target }: Shortcut): Promise<void> {
    if (target === null || !isWebLink(target)) {
      throw new UserError(BAD_LINK);
    }
    try {
      await this.openExternal(target);
    } catch {
      throw new UserError(`Could not open ${label}.`);
    }
  }

  private async openApp({ label, target }: Shortcut): Promise<void> {
    if (target === null || !this.allowedApps.has(target)) {
      throw new UserError(APP_NOT_ALLOWED);
    }
    if (this.kindOf(target) === null) {
      throw new UserError(`${NOTHING_AT_PATH} Fix it in Settings.`);
    }
    if (await this.openPath(target)) {
      throw new UserError(`Could not open ${label}.`);
    }
  }

  private assertParentIsGroup(parentId: string | null): void {
    if (parentId === null) {
      return;
    }
    if (this.shortcuts.findById(parentId)?.type !== 'group') {
      throw new UserError(GROUP_GONE);
    }
  }

  private existing(id: string): Shortcut {
    const shortcut = this.shortcuts.findById(id);
    if (!shortcut) {
      throw new UserError(SHORTCUT_GONE);
    }
    return shortcut;
  }

  private assertTargetFits(type: ShortcutType, target: string | null): void {
    if (type === 'group') {
      if (target !== null) {
        throw new UserError('A group has no address.');
      }
    } else if (type === 'link') {
      if (target === null || !isWebLink(target)) {
        throw new UserError(BAD_LINK);
      }
    } else {
      if (target === null || !path.win32.isAbsolute(target)) {
        throw new UserError(NOT_A_FULL_PATH);
      }
      if (this.kindOf(target) === null) {
        throw new UserError(NOTHING_AT_PATH);
      }
    }
  }

  private assertAllowed(type: ShortcutType, target: string | null): void {
    const isLocal = type === 'app' || type === 'path';
    if (isLocal && (target === null || !this.allowedApps.has(target))) {
      throw new UserError(APP_NOT_ALLOWED);
    }
  }
}
