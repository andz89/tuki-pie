import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ReadIcon = (target: string) => Promise<string | null>;

const PNG_PREFIX = 'data:image/png;base64,';

// Wraps a slow icon reader (one PowerShell per icon) so that:
// - reads run one at a time, never a PowerShell per app at once,
// - the same app asked twice shares one read,
// - a found icon is kept on disk, so the next start doesn't ask again.
// A failed read isn't kept, so a later open tries again.
export function cachedIconReader(read: ReadIcon, folder: string): ReadIcon {
  let queue: Promise<unknown> = Promise.resolve();
  const inFlight = new Map<string, Promise<string | null>>();

  const fileFor = (target: string) =>
    path.join(
      folder,
      `${createHash('sha256').update(target.toLowerCase()).digest('hex')}.png`,
    );

  async function fromDisk(target: string): Promise<string | null> {
    try {
      const bytes = await readFile(fileFor(target));
      return bytes.length > 0 ? PNG_PREFIX + bytes.toString('base64') : null;
    } catch {
      return null;
    }
  }

  async function keep(target: string, icon: string): Promise<void> {
    if (!icon.startsWith(PNG_PREFIX)) {
      return;
    }
    try {
      await mkdir(folder, { recursive: true });
      await writeFile(
        fileFor(target),
        Buffer.from(icon.slice(PNG_PREFIX.length), 'base64'),
      );
    } catch {
      // A cache that can't be written only means asking again next time.
    }
  }

  async function load(target: string): Promise<string | null> {
    const saved = await fromDisk(target);
    if (saved) {
      return saved;
    }
    const turn = queue.then(() => read(target));
    queue = turn.catch(() => undefined);
    const icon = await turn.catch(() => null);
    if (icon) {
      await keep(target, icon);
    }
    return icon;
  }

  return (target) => {
    const running = inFlight.get(target);
    if (running) {
      return running;
    }
    const icon = load(target).finally(() => inFlight.delete(target));
    inFlight.set(target, icon);
    return icon;
  };
}
