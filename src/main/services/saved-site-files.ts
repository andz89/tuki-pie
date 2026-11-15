import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScreenshotFiles } from './saved-site.service';

// Saved screenshots as <folder>/<id>.jpg. Ids are UUIDs the app made, so a
// name can never point outside the folder.
export function screenshotFiles(folder: string): ScreenshotFiles {
  const fileOf = (id: string) => path.join(folder, `${id}.jpg`);
  return {
    write: async (id, jpeg) => {
      await mkdir(folder, { recursive: true });
      await writeFile(fileOf(id), jpeg);
    },
    read: (id) => readFile(fileOf(id)).catch(() => null),
    remove: (id) => rm(fileOf(id), { force: true }),
  };
}
