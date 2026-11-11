import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../db/migrate';
import { SnippetRepository } from '../repositories/snippet.repository';
import { SnippetService } from './snippet.service';
import { UserError } from './user-error';

const GONE = new UserError('That snippet no longer exists.');
const CHANGED = new UserError('The snippets changed. Please try again.');

let writeClipboard: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
let service: SnippetService;

const addTwo = () => {
  service.add({ label: 'A', content: 'first' });
  return service.add({ label: 'B', content: 'second' });
};

beforeEach(() => {
  const db = new Database(':memory:');
  migrate(db);
  writeClipboard = vi.fn(async () => undefined);
  service = new SnippetService(new SnippetRepository(db), writeClipboard);
});

describe('adding', () => {
  it('appends after the existing snippets', () => {
    expect(addTwo().map(({ label, position }) => [label, position])).toEqual([
      ['A', 0],
      ['B', 1],
    ]);
  });

  it('refuses a ninth snippet', () => {
    for (let n = 0; n < 8; n += 1) {
      service.add({ label: `S${n}`, content: 'x' });
    }
    expect(() => service.add({ label: 'S9', content: 'x' })).toThrow(
      new UserError('You can save 8 snippets at most.'),
    );
    expect(service.list()).toHaveLength(8);
  });
});

describe('copying', () => {
  it('copies the stored text exactly', async () => {
    const content = '  first\r\n\tsecond 😀  ';
    const [saved] = service.add({ label: 'A', content });
    await service.copy(saved.id);
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith(content);
  });

  it('explains a failed copy', async () => {
    const [saved] = service.add({ label: 'A', content: 'x' });
    writeClipboard.mockRejectedValueOnce(new Error('busy'));
    await expect(service.copy(saved.id)).rejects.toThrow(
      new UserError('Could not copy that snippet.'),
    );
  });

  it('refuses a snippet that no longer exists', async () => {
    await expect(service.copy('gone')).rejects.toThrow(GONE);
    expect(writeClipboard).not.toHaveBeenCalled();
  });
});

describe('changing', () => {
  it('updates the name and text', () => {
    const [saved] = service.add({ label: 'A', content: 'x' });
    const [changed] = service.update({
      id: saved.id,
      label: 'New',
      content: 'y',
    });
    expect(changed).toMatchObject({ label: 'New', content: 'y' });
  });

  it('refuses to update a snippet that no longer exists', () => {
    expect(() =>
      service.update({ id: 'gone', label: 'A', content: 'x' }),
    ).toThrow(GONE);
  });

  it('closes the gap after a removal', () => {
    addTwo();
    const [, second] = service.add({ label: 'C', content: 'third' });
    const left = service.remove(second.id);
    expect(left.map(({ label, position }) => [label, position])).toEqual([
      ['A', 0],
      ['C', 1],
    ]);
  });

  it('refuses to remove a snippet that no longer exists', () => {
    expect(() => service.remove('gone')).toThrow(GONE);
  });
});

describe('reordering', () => {
  it('applies a new order', () => {
    const [first, second] = addTwo();
    expect(
      service.reorder([second.id, first.id]).map(({ label }) => label),
    ).toEqual(['B', 'A']);
  });

  it('refuses a list with a snippet missing', () => {
    const [first] = addTwo();
    expect(() => service.reorder([first.id])).toThrow(CHANGED);
  });

  it('refuses a list with an unknown snippet', () => {
    const [first, second] = addTwo();
    expect(() => service.reorder([first.id, second.id, 'extra'])).toThrow(
      CHANGED,
    );
  });

  it('refuses a list with a duplicate', () => {
    const [first] = addTwo();
    expect(() => service.reorder([first.id, first.id])).toThrow(CHANGED);
  });
});
