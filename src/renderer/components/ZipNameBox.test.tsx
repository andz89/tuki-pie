// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePieStore } from '../stores/pie.store';
import { ZipNameBox } from './ZipNameBox';

vi.mock('../api/bridge', () => ({ bridge: { window: {} } }));

let container: HTMLDivElement;
const reachedWindow = vi.fn();

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  window.addEventListener('keydown', reachedWindow);
  usePieStore.setState({
    cancelZip: vi.fn(),
    zipImages: vi.fn(async () => undefined),
  });
});

afterEach(() => {
  window.removeEventListener('keydown', reachedWindow);
  container.remove();
  reachedWindow.mockClear();
});

function press(key: string) {
  const root = createRoot(container);
  act(() => root.render(<ZipNameBox />));
  const input = container.querySelector('input');
  act(() => {
    input?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
  act(() => root.unmount());
}

describe('ZipNameBox', () => {
  it('goes back on Esc without the key reaching the donut', () => {
    press('Escape');
    expect(usePieStore.getState().cancelZip).toHaveBeenCalledOnce();
    expect(reachedWindow).not.toHaveBeenCalled();
  });

  it('saves on Enter without the key reaching the donut', () => {
    press('Enter');
    expect(usePieStore.getState().zipImages).toHaveBeenCalledOnce();
    expect(reachedWindow).not.toHaveBeenCalled();
  });
});
