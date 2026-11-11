// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { Note } from '../../shared/types';

const note = (id: string, title: string, body: string): Note => ({
  id,
  title,
  body,
  reminder: null,
  snoozedUntil: null,
  updatedAt: '2026-11-11T09:00:00.000Z',
});

let saveRequested: (() => Promise<void>) | null = null;

const bridge = {
  list: vi.fn(async () => ({
    ok: true as const,
    value: [note('a', 'Trip', 'hotel'), note('b', 'Shop', 'milk')],
  })),
  create: vi.fn(),
  update: vi.fn(async (edit: { id: string; title: string; body: string }) => ({
    ok: true as const,
    value: note(edit.id, edit.title, edit.body),
  })),
  remove: vi.fn(async () => ({ ok: true as const, value: undefined })),
  setReminder: vi.fn(),
  takeRequest: vi.fn(async () => ({ ok: true as const, value: null })),
  onChanged: vi.fn(() => () => undefined),
  onOpenRequested: vi.fn(() => () => undefined),
  onSaveRequested: vi.fn((save: () => Promise<void>) => {
    saveRequested = save;
    return () => undefined;
  }),
  settings: {
    get: vi.fn(async () => ({ ok: true as const, value: DEFAULT_SETTINGS })),
  },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (window as unknown as { notes: unknown }).notes = bridge;
  vi.clearAllMocks();
  saveRequested = null;
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function openWindow() {
  const { NotesWindow } = await import('./NotesWindow');
  root = createRoot(container);
  await act(async () => root.render(<NotesWindow />));
}

const items = () =>
  [...container.querySelectorAll('.notes-item-title')].map(
    (item) => item.textContent,
  );

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((each) =>
    each.textContent?.includes(text),
  );
  if (!found) throw new Error(`No button ${text}`);
  return found;
}

function typeInto(field: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const body = () => container.querySelector<HTMLTextAreaElement>('.notes-body');

describe('NotesWindow', () => {
  it('lists the notes', async () => {
    await openWindow();
    expect(items()).toEqual(['Trip', 'Shop']);
  });

  it('opens a note from the list', async () => {
    await openWindow();
    await act(async () => button('Shop').click());
    expect(body()?.value).toBe('milk');
  });

  it('saves typed text after a pause and moves the note to the top', async () => {
    await openWindow();
    await act(async () => button('Shop').click());
    vi.useFakeTimers();
    typeInto(body()!, 'milk and eggs');
    expect(bridge.update).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(bridge.update).toHaveBeenCalledExactlyOnceWith({
      id: 'b',
      title: 'Shop',
      body: 'milk and eggs',
    });
    expect(items()).toEqual(['Shop', 'Trip']);
  });

  it('saves at once when main asks before closing', async () => {
    await openWindow();
    await act(async () => button('Trip').click());
    typeInto(body()!, 'hotel booked');
    await act(async () => saveRequested?.());
    expect(bridge.update).toHaveBeenCalledWith({
      id: 'a',
      title: 'Trip',
      body: 'hotel booked',
    });
  });

  it('deletes the open note after asking', async () => {
    vi.stubGlobal('confirm', () => true);
    await openWindow();
    await act(async () => button('Trip').click());
    await act(async () => button('Delete').click());
    expect(bridge.remove).toHaveBeenCalledExactlyOnceWith('a');
    expect(body()).toBeNull();
    vi.unstubAllGlobals();
  });
});
