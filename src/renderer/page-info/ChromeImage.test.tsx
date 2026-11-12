// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageInfoUpdate } from '../../shared/types';
import { ChromeImage } from './ChromeImage';
import { pageInfoBridge } from './page-info-bridge';
import { usePageInfoStore } from './page-info.store';

vi.mock('./page-info-bridge', () => ({
  pageInfoBridge: { image: vi.fn(), onUpdate: vi.fn(), getState: vi.fn() },
}));

const PICTURE = { dataUrl: 'data:image/webp;base64,AAAA', width: 4, height: 2 };

let container: HTMLDivElement;
let root: Root;

function connect(chromeConnected: boolean) {
  usePageInfoStore.setState({
    update: { chromeConnected } as PageInfoUpdate,
  });
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(pageInfoBridge.image).mockReset();
  vi.mocked(pageInfoBridge.image).mockResolvedValue({
    ok: true,
    value: PICTURE,
  });
  connect(true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function show(element: React.ReactElement) {
  await act(async () => root.render(element));
}

describe('ChromeImage', () => {
  it('asks Chrome for the picture and shows it', async () => {
    await show(<ChromeImage url="https://a.com/x.png" size="thumb" alt="" />);
    expect(pageInfoBridge.image).toHaveBeenCalledExactlyOnceWith(
      'https://a.com/x.png',
      'thumb',
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      PICTURE.dataUrl,
    );
  });

  it('shows an empty box while the picture is on its way', async () => {
    vi.mocked(pageInfoBridge.image).mockReturnValue(new Promise(() => {}));
    await show(
      <ChromeImage
        url="https://a.com/x.png"
        size="thumb"
        alt=""
        className="thumb"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.thumb.is-waiting')).not.toBeNull();
  });

  it('asks nothing and says to connect Chrome while it is away', async () => {
    connect(false);
    await show(<ChromeImage url="https://a.com/x.png" size="thumb" alt="" />);
    expect(pageInfoBridge.image).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Connect Chrome to see images');
  });

  it('shows the fallback and tells its parent when Chrome had no picture', async () => {
    vi.mocked(pageInfoBridge.image).mockResolvedValue({
      ok: true,
      value: null,
    });
    const onBroken = vi.fn();
    await show(
      <ChromeImage
        url="https://a.com/x.png"
        size="thumb"
        alt=""
        onBroken={onBroken}
        fallback={<p>Broken</p>}
      />,
    );
    expect(container.textContent).toBe('Broken');
    expect(onBroken).toHaveBeenCalledOnce();
  });

  it('shows a full image through a blob address, given back afterwards', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    await show(<ChromeImage url="https://a.com/x.png" size="full" alt="" />);
    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src).toMatch(/^blob:/);
    act(() => root.unmount());
    expect(revoke).toHaveBeenCalledWith(src);
    root = createRoot(container);
    revoke.mockRestore();
  });

  it('waits until it scrolls into view when asked to', async () => {
    let reveal: (visible: boolean) => void = () => undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          reveal = (visible) => callback([{ isIntersecting: visible }]);
        }
        observe() {}
        disconnect() {}
      },
    );
    await show(
      <ChromeImage url="https://a.com/x.png" size="thumb" alt="" lazy />,
    );
    expect(pageInfoBridge.image).not.toHaveBeenCalled();
    await act(async () => reveal(true));
    expect(pageInfoBridge.image).toHaveBeenCalledOnce();
  });
});
