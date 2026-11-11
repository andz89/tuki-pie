import { mkdtempSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedIconReader } from './icon-cache';

const ICON = 'data:image/png;base64,iVBORw0KGgo=';

let folder: string;

beforeEach(() => {
  folder = path.join(mkdtempSync(path.join(tmpdir(), 'pie-icons-')), 'cache');
});

afterEach(async () => {
  await rm(path.dirname(folder), { recursive: true, force: true });
});

describe('cachedIconReader', () => {
  it('reads one icon at a time', async () => {
    let running = 0;
    let most = 0;
    const read = vi.fn(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return ICON;
    });
    const icons = cachedIconReader(read, folder);
    await Promise.all(['a', 'b', 'c'].map((target) => icons(target)));
    expect(read).toHaveBeenCalledTimes(3);
    expect(most).toBe(1);
  });

  it('shares one read when the same app is asked twice', async () => {
    const read = vi.fn(async () => ICON);
    const icons = cachedIconReader(read, folder);
    const [first, second] = await Promise.all([icons('a'), icons('a')]);
    expect(first).toBe(ICON);
    expect(second).toBe(ICON);
    expect(read).toHaveBeenCalledOnce();
  });

  it('keeps a found icon on disk for the next start', async () => {
    await cachedIconReader(async () => ICON, folder)('C:\\Apps\\Chat');
    const read = vi.fn(async () => null);
    const icon = await cachedIconReader(read, folder)('c:\\apps\\chat');
    expect(icon).toBe(ICON);
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps nothing when no icon was found, so the next open tries again', async () => {
    const read = vi.fn(async () => null);
    const icons = cachedIconReader(read, folder);
    expect(await icons('a')).toBeNull();
    expect(await icons('a')).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
    expect(() => readdirSync(folder)).toThrow();
  });

  it('carries on after a read that throws', async () => {
    const read = vi
      .fn<(target: string) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('powershell gone'))
      .mockResolvedValueOnce(ICON);
    const icons = cachedIconReader(read, folder);
    expect(await icons('a')).toBeNull();
    expect(await icons('b')).toBe(ICON);
  });
});
