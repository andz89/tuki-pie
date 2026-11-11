import { randomUUID } from 'node:crypto';
import { MAX_SLICES, MIN_SLICES } from '../../shared/schemas/slice.schema';
import type { NewSlice, Slice, SliceEdit, SliceType } from '../../shared/types';
import type { AllowedAppRepository } from '../repositories/allowed-app.repository';
import type { SliceRepository } from '../repositories/slice.repository';
import type { PathKind } from './path-kind';
import { UserError } from './user-error';

const TYPE_NAMES: Record<SliceType, string> = {
  app: 'App',
  folder: 'Folder',
  note: 'Note',
};

const EXPECTED_KIND: Record<SliceType, PathKind> = {
  app: 'file',
  folder: 'folder',
  note: 'file',
};

// Windows runs these when they're opened, so a "note" must not be one of them.
const PROGRAM_FILE =
  /\.(exe|bat|cmd|com|msi|ps1|lnk|scr|vbs|vbe|js|jse|wsf|wsh|hta|pif|cpl|jar|reg|url)$/i;

const APP_NOT_ALLOWED = 'App not allowed. Check Settings.';
const SLICE_GONE = 'That slice no longer exists.';

export class SliceService {
  constructor(
    private readonly slices: SliceRepository,
    private readonly allowedApps: AllowedAppRepository,
    private readonly kindOf: (path: string) => PathKind,
    private readonly openPath: (path: string) => Promise<string>,
    private readonly findShortcutUsingApp: (
      path: string,
    ) => string | undefined = () => undefined,
  ) {}

  list(): Slice[] {
    return this.slices.findAll();
  }

  async openSlice(id: string): Promise<void> {
    const slice = this.slices.findById(id);
    if (!slice) {
      throw new UserError(SLICE_GONE);
    }

    this.assertAllowed(slice);
    if (!this.pathExists(slice)) {
      throw new UserError(
        `${TYPE_NAMES[slice.type]} not found. Fix it in Settings.`,
      );
    }
    this.assertNotProgramNote(slice);

    const failure = await this.openPath(slice.path);
    if (failure) {
      throw new UserError(`Could not open ${slice.label}.`);
    }
  }

  add(item: NewSlice): Slice[] {
    const count = this.slices.count();
    if (count >= MAX_SLICES) {
      throw new UserError(`The donut can hold ${MAX_SLICES} slices at most.`);
    }

    this.assertUsable(item);
    this.slices.insert({ ...item, id: randomUUID(), position: count });
    return this.list();
  }

  update(edit: SliceEdit): Slice[] {
    if (!this.slices.findById(edit.id)) {
      throw new UserError(SLICE_GONE);
    }

    this.assertUsable(edit);
    this.slices.update(edit);
    return this.list();
  }

  remove(id: string): Slice[] {
    if (!this.slices.findById(id)) {
      throw new UserError(SLICE_GONE);
    }
    if (this.slices.count() <= MIN_SLICES) {
      throw new UserError(`The donut needs at least ${MIN_SLICES} slices.`);
    }

    this.slices.remove(id);
    this.slices.setOrder(this.list().map((slice) => slice.id));
    return this.list();
  }

  reorder(ids: string[]): Slice[] {
    const current = new Set(this.list().map((slice) => slice.id));
    const isEverySliceOnce =
      ids.length === current.size &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.has(id));
    if (!isEverySliceOnce) {
      throw new UserError('The slices changed. Please try again.');
    }

    this.slices.setOrder(ids);
    return this.list();
  }

  listAllowedApps(): string[] {
    return this.allowedApps.findAll();
  }

  allowApp(path: string): void {
    this.allowedApps.add(path);
  }

  removeAllowedApp(path: string): string[] {
    const shortcutLabel = this.findShortcutUsingApp(path);
    if (shortcutLabel) {
      throw new UserError(
        `${shortcutLabel} still uses this app. Remove that shortcut first.`,
      );
    }

    this.allowedApps.remove(path);
    return this.listAllowedApps();
  }

  private assertUsable(item: NewSlice): void {
    this.assertAllowed(item);
    if (!this.pathExists(item)) {
      throw new UserError(`${TYPE_NAMES[item.type]} not found.`);
    }
    this.assertNotProgramNote(item);
  }

  private assertAllowed({ type, path }: NewSlice): void {
    if (type === 'app' && !this.allowedApps.has(path)) {
      throw new UserError(APP_NOT_ALLOWED);
    }
  }

  private pathExists({ type, path }: NewSlice): boolean {
    return this.kindOf(path) === EXPECTED_KIND[type];
  }

  private assertNotProgramNote({ type, path }: NewSlice): void {
    if (type === 'note' && PROGRAM_FILE.test(path)) {
      throw new UserError('That file is a program, so add it as an App.');
    }
  }
}
