import { existsSync } from 'node:fs';
import path from 'node:path';
import { UserError } from '../services/user-error';
import type { ExplorerWindow } from './explorer-selection';
import { cleanZipName, freeZipPath, isImageFile, writeZip } from './zip-files';

export const NO_IMAGES =
  'Select images in File Explorer, then open the donut there.';

export const SAVE_FAILED = 'Could not save the zip there.';

export interface ZipDeps {
  frontExplorerWindow: () => ExplorerWindow | null;
  readSelection: (window: ExplorerWindow) => Promise<string[]>;
  exists: (file: string) => boolean;
  writeZip: (files: string[], target: string) => Promise<void>;
  // Tells the person where the zip went.
  announce: (zipFile: string, count: number) => void;
}

// The images selected in Explorer when the donut last opened. The donut
// takes the focus as it opens, so this has to be read before it does.
export class ZipSelection {
  private images: Promise<string[]> = Promise.resolve([]);

  constructor(private readonly deps: ZipDeps) {}

  // Called just before the donut shows.
  noteFrontWindow(): void {
    const window = this.deps.frontExplorerWindow();
    this.images = window
      ? this.deps
          .readSelection(window)
          .then((files) => files.filter(isImageFile))
          .catch(() => [])
      : Promise.resolve([]);
  }

  async count(): Promise<number> {
    return (await this.images).length;
  }

  // Zips the noted images beside the first one, under the typed name. A
  // name already taken gets a number, so nothing is ever replaced.
  async zip(typedName: string): Promise<string> {
    const images = (await this.images).filter((file) => this.deps.exists(file));
    if (images.length === 0) {
      throw new UserError(NO_IMAGES);
    }
    const target = freeZipPath(
      path.dirname(images[0]),
      cleanZipName(typedName),
      this.deps.exists,
    );
    try {
      await this.deps.writeZip(images, target);
    } catch (error) {
      console.warn('Could not write the zip:', error);
      throw new UserError(SAVE_FAILED);
    }
    this.deps.announce(target, images.length);
    return target;
  }
}

export const defaultZipDeps = {
  exists: existsSync,
  writeZip,
} satisfies Partial<ZipDeps>;
