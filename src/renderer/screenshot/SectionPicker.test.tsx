// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const screenshot = {
  image: vi.fn(),
  cancel: vi.fn(),
  pick: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (window as unknown as { screenshot: unknown }).screenshot = screenshot;
  screenshot.image.mockResolvedValue({
    ok: true,
    value: 'data:image/png;base64,AA',
  });
  container = document.createElement('div');
  document.body.append(container);
  HTMLElement.prototype.setPointerCapture = () => undefined;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.assign(event, { pointerId: 1 });
  return event;
}

describe('SectionPicker', () => {
  it('drops a half-drawn area when the pointer is lost', async () => {
    const { SectionPicker } = await import('./SectionPicker');
    root = createRoot(container);
    await act(async () => root.render(<SectionPicker />));
    const picker = container.querySelector('.picker') as HTMLElement;

    act(() => {
      picker.dispatchEvent(pointer('pointerdown', 10, 10));
      picker.dispatchEvent(pointer('pointermove', 200, 200));
    });
    expect(container.querySelector('.picker-area')).not.toBeNull();

    act(() => {
      picker.dispatchEvent(pointer('pointercancel', 200, 200));
    });
    expect(container.querySelector('.picker-area')).toBeNull();

    // A later move must not draw from the lost start.
    act(() => {
      picker.dispatchEvent(pointer('pointermove', 300, 300));
    });
    expect(container.querySelector('.picker-area')).toBeNull();
  });
});
