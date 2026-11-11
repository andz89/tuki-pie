import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanZipName,
  entryNames,
  freeZipPath,
  isImageFile,
  writeZip,
} from './zip-files';

describe('isImageFile', () => {
  it('knows picture files whatever the case', () => {
    expect(isImageFile('C:\\a\\photo.JPG')).toBe(true);
    expect(isImageFile('C:\\a\\scan.tiff')).toBe(true);
    expect(isImageFile('C:\\a\\logo.svg')).toBe(true);
  });

  it('leaves out everything else', () => {
    expect(isImageFile('C:\\a\\report.pdf')).toBe(false);
    expect(isImageFile('C:\\a\\folder')).toBe(false);
    expect(isImageFile('C:\\a\\photo.png.exe')).toBe(false);
  });
});

describe('freeZipPath', () => {
  const folder = path.join('C:', 'Pics');

  it('uses the name as it is when free', () => {
    expect(freeZipPath(folder, 'Holiday', () => false)).toBe(
      path.join(folder, 'Holiday.zip'),
    );
  });

  it('counts up past names that are taken', () => {
    const taken = new Set([
      path.join(folder, 'Images.zip'),
      path.join(folder, 'Images (2).zip'),
    ]);
    expect(freeZipPath(folder, 'Images', (file) => taken.has(file))).toBe(
      path.join(folder, 'Images (3).zip'),
    );
  });
});

describe('cleanZipName', () => {
  it('keeps an ordinary name, in any language', () => {
    expect(cleanZipName('Holiday 2026')).toBe('Holiday 2026');
    expect(cleanZipName('Urlaub München 写真')).toBe('Urlaub München 写真');
  });

  it('uses Images for an empty name', () => {
    expect(cleanZipName('')).toBe('Images');
    expect(cleanZipName('   ')).toBe('Images');
    expect(cleanZipName('???')).toBe('Images');
  });

  it('drops a typed .zip, since it is added anyway', () => {
    expect(cleanZipName('Holiday.ZIP')).toBe('Holiday');
  });

  it('turns characters Windows refuses into spaces', () => {
    expect(cleanZipName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
  });

  it('cannot reach another folder', () => {
    expect(cleanZipName('..\\..\\Windows\\evil')).toBe('.. .. Windows evil');
  });

  it('drops dots and spaces at the end, which Windows strips', () => {
    expect(cleanZipName('Holiday...  ')).toBe('Holiday');
  });

  it('steers clear of names Windows keeps for devices', () => {
    expect(cleanZipName('con')).toBe('con zip');
    expect(cleanZipName('LPT1')).toBe('LPT1 zip');
  });

  it('shortens a very long name', () => {
    expect(cleanZipName('x'.repeat(300))).toHaveLength(120);
  });
});

describe('entryNames', () => {
  it('keeps each file name', () => {
    expect(entryNames(['C:\\a\\one.png', 'C:\\a\\two.jpg'])).toEqual([
      'one.png',
      'two.jpg',
    ]);
  });

  it('numbers a second file with the same name', () => {
    expect(
      entryNames(['C:\\a\\photo.png', 'C:\\b\\Photo.png', 'C:\\c\\photo.png']),
    ).toEqual(['photo.png', 'Photo (2).png', 'photo (3).png']);
  });
});

describe('writeZip', () => {
  let folder: string;

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('writes a zip holding every file, names in other alphabets too', async () => {
    folder = mkdtempSync(path.join(tmpdir(), 'pie-zip-'));
    const files = ['one.png', 'Ünïcødé 写真.bmp'].map((name) => {
      const file = path.join(folder, name);
      writeFileSync(file, `picture ${name}`);
      return file;
    });
    const target = path.join(folder, 'Images.zip');

    await writeZip(files, target);

    const bytes = readFileSync(target);
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 3, 4]));
    expect(bytes.includes(Buffer.from('one.png'))).toBe(true);
    expect(bytes.includes(Buffer.from('Ünïcødé 写真.bmp', 'utf8'))).toBe(true);
  });

  it('moves the finished zip into place over whatever is there', async () => {
    folder = mkdtempSync(path.join(tmpdir(), 'pie-zip-'));
    const image = path.join(folder, 'one.png');
    writeFileSync(image, 'picture');
    const target = path.join(folder, 'Images.zip');
    writeFileSync(target, 'old zip');

    await writeZip([image], target);

    expect(readFileSync(target).subarray(0, 2).toString()).toBe('PK');
    expect(readdirSync(folder).sort()).toEqual(['Images.zip', 'one.png']);
  });

  it('keeps the old file and leaves no leftovers when writing fails', async () => {
    folder = mkdtempSync(path.join(tmpdir(), 'pie-zip-'));
    const target = path.join(folder, 'Images.zip');
    writeFileSync(target, 'keep me');

    await expect(
      writeZip([path.join(folder, 'gone.png')], target),
    ).rejects.toThrow();

    expect(readFileSync(target, 'utf8')).toBe('keep me');
    expect(readdirSync(folder)).toEqual(['Images.zip']);
  });
});
