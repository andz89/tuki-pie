import fs from 'node:fs';

export type PathKind = 'file' | 'folder' | null;

export function kindOfPath(path: string): PathKind {
  try {
    return fs.statSync(path).isDirectory() ? 'folder' : 'file';
  } catch {
    return null;
  }
}
