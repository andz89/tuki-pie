// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';

const reminder = vi.hoisted(() => ({
  list: vi.fn(),
  open: vi.fn(),
  snooze: vi.fn(),
  done: vi.fn(),
  fit: vi.fn(),
  onUpdate: vi.fn(() => () => undefined),
  settings: { get: vi.fn() },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (window as unknown as { reminder: unknown }).reminder = reminder;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  reminder.list.mockResolvedValue({
    ok: true,
    value: [{ id: 'n1', title: 'Call Sam', preview: '' }],
  });
  reminder.settings.get.mockResolvedValue({
    ok: true,
    value: DEFAULT_SETTINGS,
  });
  reminder.fit.mockResolvedValue({ ok: true, value: undefined });
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderCard() {
  const { ReminderCard } = await import('./ReminderCard');
  root = createRoot(container);
  await act(async () => root.render(<ReminderCard />));
}

function clickDone() {
  const button = [...container.querySelectorAll('button')].find(
    (each) => each.textContent === 'Done',
  );
  button?.click();
}

describe('ReminderCard', () => {
  it('hides a reminder once it is done', async () => {
    reminder.done.mockResolvedValue({ ok: true, value: undefined });
    await renderCard();
    await act(async () => clickDone());
    expect(container.textContent).not.toContain('Call Sam');
  });

  it('shows the reminder again when the action failed', async () => {
    reminder.done.mockResolvedValue({ ok: false, error: 'Note gone.' });
    await renderCard();
    await act(async () => clickDone());
    expect(container.textContent).toContain('Call Sam');
  });
});
