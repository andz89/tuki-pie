import { app, nativeImage, shell } from 'electron';
import type { Shortcut } from '../../shared/schemas/shortcut.schema';
import { readAppIcon } from './app-icon';
import { cachedIconReader } from './icon-cache';
import { shellIconOf } from './shell-icon';

// An app shortcut's icon, by the shortcut's id. Read from the saved app's
// file, never from an address the donut sends, so it can't ask about any
// other file. Store-app icons take a PowerShell each: one at a time, kept
// on disk in `cacheFolder`.
export function shortcutIcons(
  find: (id: string) => Shortcut | null,
  cacheFolder: string,
): (id: string) => Promise<string | null> {
  const shellIcon = cachedIconReader(shellIconOf, cacheFolder);
  return async (id) => {
    const shortcut = find(id);
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
  };
}
