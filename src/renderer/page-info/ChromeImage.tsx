import { useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PageImageSize } from '../../shared/types';
import { blobUrlFromDataUrl } from './blob-url';
import { ChromeImageSourceContext } from './chrome-image-source';
import { pageInfoBridge } from './page-info-bridge';
import { usePageInfoStore } from './page-info.store';

const OFFLINE = 'Connect Chrome to see images';

type State =
  | { kind: 'waiting' }
  | { kind: 'ready'; src: string }
  | { kind: 'broken' };

interface ChromeImageProps {
  // The image's full address, already resolved against the page.
  url: string;
  size: PageImageSize;
  alt: string;
  className?: string;
  // Ask only once it scrolls into view: for long lists.
  lazy?: boolean;
  // Shown when Chrome had no picture, or it didn't decode.
  fallback?: ReactNode;
  // Shown while Chrome isn't connected, in place of the usual words.
  offline?: ReactNode;
  onBroken?: () => void;
}

// A page image, fetched by Chrome with your session. The Page Info window
// never loads page images itself.
export function ChromeImage({
  url,
  size,
  alt,
  className = '',
  lazy = false,
  fallback = null,
  offline,
  onBroken,
}: ChromeImageProps) {
  const source = useContext(ChromeImageSourceContext);
  const pageInfoConnected = usePageInfoStore(
    (state) => state.update.chromeConnected,
  );
  const chromeConnected = source ? source.connected : pageInfoConnected;
  // Read when asking, so a new source object never asks again by itself.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [state, setState] = useState<State>({ kind: 'waiting' });
  const [isInView, setIsInView] = useState(!lazy);
  const boxRef = useRef<HTMLSpanElement>(null);
  // Called once per broken picture, even if the parent passes a new function.
  const brokenRef = useRef(onBroken);
  brokenRef.current = onBroken;

  // The box exists only while waiting, so this runs again once Chrome
  // connects and the box appears.
  useEffect(() => {
    const box = boxRef.current;
    if (isInView || !box) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(({ isIntersecting }) => isIntersecting)) {
        setIsInView(true);
        observer.disconnect();
      }
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [isInView, chromeConnected]);

  useEffect(() => {
    if (!chromeConnected || !isInView) {
      return;
    }
    let isCurrent = true;
    let blobUrl: string | null = null;
    setState({ kind: 'waiting' });
    const fetchImage = sourceRef.current?.fetch ?? pageInfoBridge.image;
    void fetchImage(url, size).then((result) => {
      if (!isCurrent) {
        return;
      }
      if (!result.ok || result.value === null) {
        setState({ kind: 'broken' });
        brokenRef.current?.();
        return;
      }
      // A full image can be megabytes: one blob address, given back below.
      const src =
        size === 'full'
          ? (blobUrl = blobUrlFromDataUrl(result.value.dataUrl))
          : result.value.dataUrl;
      setState({ kind: 'ready', src });
    });
    return () => {
      isCurrent = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url, size, chromeConnected, isInView]);

  if (!chromeConnected) {
    return (
      offline ?? (
        <span className={`${className} chrome-image-offline`} title={OFFLINE}>
          {OFFLINE}
        </span>
      )
    );
  }
  if (state.kind === 'broken') {
    return <>{fallback}</>;
  }
  if (state.kind === 'waiting') {
    return (
      <span
        ref={boxRef}
        className={`${className} is-waiting`}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      className={className || undefined}
      src={state.src}
      alt={alt}
      onError={() => {
        setState({ kind: 'broken' });
        brokenRef.current?.();
      }}
    />
  );
}
