// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageInfoBridge } from './page-info-bridge';
import { usePageInfoStore } from './page-info.store';
import {
  HistoryButton,
  HistoryDialog,
  readDays,
  useHistorySearch,
  visitTime,
} from './HistoryDialog';

vi.mock('./page-info-bridge', () => ({
  pageInfoBridge: {
    history: vi.fn(async () => ({
      ok: true,
      value: [
        { url: 'https://flowsummit.com/register', title: 'Flow', lastVisit: 0 },
        { url: 'https://flowsummit.com/day-1', title: '', lastVisit: 1 },
      ],
    })),
    newTab: vi.fn(async () => ({ ok: true, value: undefined })),
  },
}));

let container: HTMLDivElement;
let root: Root;

const button = (text: string) =>
  [...container.querySelectorAll('button')].find((each) =>
    each.textContent?.startsWith(text),
  )!;
const input = (label: string) =>
  container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

// Sets an input's value the way typing does, so React sees the change.
function type(field: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.close ??= function close() {};
  HTMLDialogElement.prototype.showModal ??= function showModal() {};
  useHistorySearch.setState({
    isOpen: false,
    typedDays: '1',
    text: '',
    match: 'exact',
    found: { state: 'idle' },
    ticked: new Set(),
    copied: null,
  });
  usePageInfoStore.setState((state) => ({
    update: { ...state.update, chromeConnected: true },
  }));
  vi.mocked(pageInfoBridge.history).mockClear();
  vi.mocked(pageInfoBridge.newTab).mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <>
        <HistoryButton />
        <HistoryDialog />
      </>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('HistoryDialog', () => {
  it('opens on the button, with the text box in focus, and searches on Search only', async () => {
    expect(container.querySelector('.history-filters')).toBeNull();
    act(() => button('').click());
    expect(container.querySelector('.history-filters')).not.toBeNull();
    expect(document.activeElement).toBe(input('Address'));
    expect(pageInfoBridge.history).not.toHaveBeenCalled();

    type(input('Days'), '3');
    type(input('Address'), ' flowsummit ');
    act(() =>
      container
        .querySelector<HTMLInputElement>('.history-exact input')!
        .click(),
    );
    await act(async () => button('Search').click());
    expect(pageInfoBridge.history).toHaveBeenCalledWith(
      'flowsummit',
      3,
      'contains',
    );
    expect(container.querySelectorAll('.history-open')).toHaveLength(2);
  });

  it('opens one page from its row, and keeps the results for next time', async () => {
    act(() => button('').click());
    await act(async () => button('Search').click());
    await act(async () =>
      container.querySelector<HTMLButtonElement>('.history-open')!.click(),
    );
    expect(pageInfoBridge.newTab).toHaveBeenCalledWith(
      'https://flowsummit.com/register',
      false,
    );
    expect(container.querySelector('.history-filters')).toBeNull();
    act(() => button('').click());
    expect(container.querySelectorAll('.history-open')).toHaveLength(2);
  });

  it('opens the ticked pages together, in list order', async () => {
    act(() => button('').click());
    await act(async () => button('Search').click());
    const open = button('Open selected');
    expect(open.disabled).toBe(true);
    const ticks = container.querySelectorAll<HTMLInputElement>(
      '.history-list .history-tick',
    );
    act(() => ticks[1].click());
    act(() => ticks[0].click());
    expect(open.textContent).toBe('Open selected (2)');
    await act(async () => open.click());
    expect(
      vi.mocked(pageInfoBridge.newTab).mock.calls.map(([url]) => url),
    ).toEqual([
      'https://flowsummit.com/register',
      'https://flowsummit.com/day-1',
    ]);
    expect(useHistorySearch.getState().ticked.size).toBe(0);
  });

  it('ticks and unticks every page with Select all', async () => {
    act(() => button('').click());
    await act(async () => button('Search').click());
    const all = container.querySelector<HTMLInputElement>(
      '.history-select-all input',
    )!;
    const ticks = () => [
      ...container.querySelectorAll<HTMLInputElement>(
        '.history-list .history-tick',
      ),
    ];
    act(() => ticks()[0].click());
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(true);
    act(() => all.click());
    expect(ticks().every((tick) => tick.checked)).toBe(true);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
    expect(button('Open selected').textContent).toBe('Open selected (2)');
    act(() => all.click());
    expect(ticks().some((tick) => tick.checked)).toBe(false);
  });

  it('shows the error when Chrome cannot be read', async () => {
    vi.mocked(pageInfoBridge.history).mockResolvedValueOnce({
      ok: false,
      error: 'Chrome is not connected.',
    });
    act(() => button('').click());
    await act(async () => button('Search').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Chrome is not connected.',
    );
  });

  it('does not spring open again after being taken down while open', async () => {
    act(() => button('').click());
    act(() => root.unmount());
    expect(useHistorySearch.getState().isOpen).toBe(false);
    root = createRoot(container);
    await act(async () => root.render(<HistoryDialog />));
    expect(container.querySelector('.history-filters')).toBeNull();
  });

  it('reads the days box', () => {
    expect(readDays('1')).toBe(1);
    expect(readDays(' 30 ')).toBe(30);
    expect(readDays('0')).toBeNull();
    expect(readDays('')).toBeNull();
    expect(readDays('2.5')).toBeNull();
    expect(readDays('3651')).toBeNull();
  });

  it('writes the visit time as day, month and clock', () => {
    expect(visitTime(Date.UTC(2026, 10, 14, 10, 42))).toMatch(
      /^14 Nov \d\d:\d\d$/,
    );
  });
});
