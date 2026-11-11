// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useWindowFocused } from './useWindowFocused';

function Probe() {
  return <span>{useWindowFocused() ? 'focused' : 'away'}</span>;
}

describe('useWindowFocused', () => {
  it('follows the window gaining and losing focus', () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Probe />));
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(container.textContent).toBe('away');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(container.textContent).toBe('focused');
    act(() => root.unmount());
  });
});
