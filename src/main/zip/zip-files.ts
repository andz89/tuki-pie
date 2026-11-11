import { createWriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import yazl from 'yazl';

// Picture files the Zip slice picks out of what is selected in Explorer.
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
  '.avif',
  '.svg',
  '.ico',
]);

// Already compressed, so packing them again only costs time.
const STORED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
  '.avif',
]);

export const ZIP_BASE_NAME = 'Images';

export function isImageFile(file: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

// Longest zip name kept, before " (2).zip" is added.
const MAX_NAME_LENGTH = 120;

// Names Windows keeps for devices, which no file may have.
const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

// Turns what the person typed into a name Windows accepts: no folder parts,
// no characters Windows refuses, no ".zip" (added later), never empty.
export function cleanZipName(typed: string): string {
  let name = typed
    // Control characters are on purpose: Windows refuses them in names.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.zip$/i, '')
    .replace(/[. ]+$/, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  if (RESERVED_NAMES.test(name)) {
    name = `${name} zip`;
  }
  return name || ZIP_BASE_NAME;
}

// "Name.zip", or "Name (2).zip" and up when that name is taken.
export function freeZipPath(
  folder: string,
  baseName: string,
  exists: (file: string) => boolean,
): string {
  for (let number = 1; ; number++) {
    const name =
      number === 1 ? `${baseName}.zip` : `${baseName} (${number}).zip`;
    const file = path.join(folder, name);
    if (!exists(file)) {
      return file;
    }
  }
}

// Each file's name inside the zip. Search results can hold two files with
// the same name from different folders, so the second becomes "name (2)".
export function entryNames(files: string[]): string[] {
  const taken = new Set<string>();
  return files.map((file) => {
    const ext = path.extname(file);
    const stem = path.basename(file, ext);
    let name = `${stem}${ext}`;
    for (let number = 2; taken.has(name.toLowerCase()); number++) {
      name = `${stem} (${number})${ext}`;
    }
    taken.add(name.toLowerCase());
    return name;
  });
}

// Writes the files into a zip at `target`. The zip is written beside the
// target first and moved into place only once complete, so nothing is ever
// left half written.
export async function writeZip(files: string[], target: string): Promise<void> {
  const zip = new yazl.ZipFile();
  const names = entryNames(files);
  files.forEach((file, index) => {
    zip.addFile(file, names[index], {
      compress: !STORED_EXTENSIONS.has(path.extname(file).toLowerCase()),
    });
  });
  zip.end();

  const partial = `${target}.${randomBytes(4).toString('hex')}.part`;
  const output = createWriteStream(partial, { flags: 'wx' });
  try {
    await new Promise<void>((resolve, reject) => {
      // A file that can't be read (deleted, locked) is reported here.
      zip.on('error', reject);
      zip.outputStream.on('error', reject);
      output.on('error', reject);
      output.on('close', resolve);
      zip.outputStream.pipe(output);
    });
    await rename(partial, target);
  } catch (error) {
    output.destroy();
    await rm(partial, { force: true });
    throw error;
  }
}
