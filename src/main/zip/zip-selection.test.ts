import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { UserError } from '../services/user-error';
import { NO_IMAGES, SAVE_FAILED, ZipSelection } from './zip-selection';
import type { ZipDeps } from './zip-selection';

const folder = path.join('C:', 'Pics');
const inFolder = (name: string) => path.join(folder, name);
const explorer = { id: 42n, title: 'Pics' };

function makeSelection(overrides: Partial<ZipDeps> = {}) {
  const deps: ZipDeps = {
    frontExplorerWindow: () => explorer,
    readSelection: vi
      .fn()
      .mockResolvedValue([
        inFolder('a.png'),
        inFolder('notes.txt'),
        inFolder('b.jpg'),
      ]),
    isFile: () => true,
    reserve: () => true,
    release: vi.fn().mockResolvedValue(undefined),
    writeZip: vi.fn().mockResolvedValue(undefined),
    announce: vi.fn(),
    ...overrides,
  };
  return { selection: new ZipSelection(deps), deps };
}

describe('ZipSelection', () => {
  it('counts nothing before the donut has opened', async () => {
    const { selection } = makeSelection();
    expect(await selection.count()).toBe(0);
  });

  it('counts only the images selected in the Explorer window in front', async () => {
    const { selection, deps } = makeSelection();
    selection.noteFrontWindow();
    expect(deps.readSelection).toHaveBeenCalledWith(explorer);
    expect(await selection.count()).toBe(2);
  });

  it('counts nothing when Explorer is not in front', async () => {
    const { selection, deps } = makeSelection({
      frontExplorerWindow: () => null,
    });
    selection.noteFrontWindow();
    expect(deps.readSelection).not.toHaveBeenCalled();
    expect(await selection.count()).toBe(0);
  });

  it('counts nothing when Explorer could not be asked', async () => {
    const { selection } = makeSelection({
      readSelection: vi.fn().mockRejectedValue(new Error('broken')),
    });
    selection.noteFrontWindow();
    expect(await selection.count()).toBe(0);
  });

  it('zips the images next to the first one under the typed name', async () => {
    const { selection, deps } = makeSelection();
    selection.noteFrontWindow();
    const target = await selection.zip('Holiday 2026');
    expect(target).toBe(inFolder('Holiday 2026.zip'));
    expect(deps.writeZip).toHaveBeenCalledWith(
      [inFolder('a.png'), inFolder('b.jpg')],
      inFolder('Holiday 2026.zip'),
    );
    expect(deps.announce).toHaveBeenCalledWith(inFolder('Holiday 2026.zip'), 2);
  });

  it('uses Images when no name was typed', async () => {
    const { selection } = makeSelection();
    selection.noteFrontWindow();
    expect(await selection.zip('   ')).toBe(inFolder('Images.zip'));
  });

  it('numbers a name that is taken instead of replacing it', async () => {
    const { selection } = makeSelection({
      reserve: (file) => file === inFolder('Holiday (2).zip'),
    });
    selection.noteFrontWindow();
    expect(await selection.zip('Holiday')).toBe(inFolder('Holiday (2).zip'));
  });

  it('skips images deleted since the donut opened', async () => {
    const { selection, deps } = makeSelection({
      isFile: (file) => file === inFolder('b.jpg'),
    });
    selection.noteFrontWindow();
    await selection.zip('x');
    expect(deps.writeZip).toHaveBeenCalledWith(
      [inFolder('b.jpg')],
      inFolder('x.zip'),
    );
  });

  it('explains what to do when there are no images', async () => {
    const { selection, deps } = makeSelection({
      frontExplorerWindow: () => null,
    });
    selection.noteFrontWindow();
    await expect(selection.zip('x')).rejects.toThrow(new UserError(NO_IMAGES));
    expect(deps.writeZip).not.toHaveBeenCalled();
  });

  it('turns a failed write into a message', async () => {
    const { selection, deps } = makeSelection({
      writeZip: vi.fn().mockRejectedValue(new Error('EACCES')),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    selection.noteFrontWindow();
    await expect(selection.zip('x')).rejects.toThrow(
      new UserError(SAVE_FAILED),
    );
    expect(deps.announce).not.toHaveBeenCalled();
    expect(deps.release).toHaveBeenCalledWith(inFolder('x.zip'));
  });

  it('leaves out a folder named like a picture', async () => {
    const { selection, deps } = makeSelection({
      readSelection: vi
        .fn()
        .mockResolvedValue([inFolder('trip.jpg'), inFolder('b.jpg')]),
      isFile: (file) => file !== inFolder('trip.jpg'),
    });
    selection.noteFrontWindow();
    await selection.zip('x');
    expect(deps.writeZip).toHaveBeenCalledWith(
      [inFolder('b.jpg')],
      inFolder('x.zip'),
    );
  });
});
