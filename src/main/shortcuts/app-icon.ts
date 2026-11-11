// --- An app's own icon ---------------------------------------------------------
// Asked about a Windows shortcut (.lnk) file, Windows gives the shortcut's own
// icon: a blank page with an arrow. So for a shortcut, the icon it names
// comes first, then the program it opens, then the picture Explorer shows for
// it (a Store app has neither of the first two). An .ico file is read as a
// picture: asked for its file icon, Windows gives a blank page too.

export interface LinkDetails {
  target?: string;
  icon?: string;
}

export type IconStep =
  // An image file, read as it is.
  | { kind: 'image'; path: string }
  // A program or folder's icon, as Windows gives it.
  | { kind: 'file'; path: string }
  // The picture Explorer shows. Slow, so it comes last.
  | { kind: 'shell'; path: string };

export interface IconReader {
  // Electron's shell.readShortcutLink. Throws when the file is no shortcut.
  readLink: (path: string) => LinkDetails;
  // Each returns an image address, or null when it has no picture.
  imageOf: (path: string) => Promise<string | null>;
  iconOf: (path: string) => Promise<string | null>;
  shellIconOf: (path: string) => Promise<string | null>;
}

// %SystemRoot% and the like, as shortcuts often store them.
export function expandVariables(
  path: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return path.replace(/%([^%]+)%/g, (whole, name: string) => {
    const key = Object.keys(env).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase(),
    );
    return key ? (env[key] ?? whole) : whole;
  });
}

const isShortcut = (path: string) => /\.lnk$/i.test(path);
const isImageFile = (path: string) => /\.(ico|png)$/i.test(path);

const stepFor = (path: string): IconStep =>
  isImageFile(path) ? { kind: 'image', path } : { kind: 'file', path };

// Where to read the icon from, best first.
export function iconSteps(
  target: string,
  readLink: IconReader['readLink'],
): IconStep[] {
  const steps: IconStep[] = [];
  if (isShortcut(target)) {
    try {
      const { icon, target: linked } = readLink(target);
      for (const found of [icon, linked]) {
        const path = expandVariables(found?.trim() ?? '');
        if (path && !steps.some((step) => step.path === path)) {
          steps.push(stepFor(path));
        }
      }
    } catch {
      // Not a readable shortcut: Explorer may still know its picture.
    }
  } else {
    steps.push(stepFor(target));
  }
  steps.push({ kind: 'shell', path: target });
  return steps;
}

export async function readAppIcon(
  target: string,
  reader: IconReader,
): Promise<string | null> {
  const read = {
    image: reader.imageOf,
    file: reader.iconOf,
    shell: reader.shellIconOf,
  };
  for (const { kind, path } of iconSteps(target, reader.readLink)) {
    try {
      const icon = await read[kind](path);
      if (icon) {
        return icon;
      }
    } catch {
      // A missing or unreadable file: try the next place.
    }
  }
  return null;
}
