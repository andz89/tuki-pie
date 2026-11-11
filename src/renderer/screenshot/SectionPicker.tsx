import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import type { ScreenshotBridge } from '../../shared/types';
import { areaBetween, isBigEnough } from './selection';
import type { Point } from './selection';

declare global {
  interface Window {
    screenshot: ScreenshotBridge;
  }
}

const bridge: ScreenshotBridge = window.screenshot;

export function SectionPicker() {
  const [image, setImage] = useState<string | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);

  useEffect(() => {
    void bridge.image().then((result) => {
      if (result.ok && result.value) {
        setImage(result.value);
      } else {
        void bridge.cancel();
      }
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void bridge.cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const area = start && end ? areaBetween(start, end) : null;

  const handleDown = (event: PointerEvent<HTMLDivElement>) => {
    // A right click gives up, as in most screenshot tools.
    if (event.button === 2) {
      void bridge.cancel();
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    setStart(point);
    setEnd(point);
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start) {
      setEnd({ x: event.clientX, y: event.clientY });
    }
  };

  const handleUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!start) {
      return;
    }
    const picked = areaBetween(start, { x: event.clientX, y: event.clientY });
    setStart(null);
    setEnd(null);
    if (isBigEnough(picked)) {
      void bridge.pick(picked);
    }
  };

  return (
    <div
      className="picker"
      style={image ? { backgroundImage: `url(${image})` } : undefined}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      {area ? (
        <div
          className="picker-area"
          style={{
            left: area.x,
            top: area.y,
            width: area.width,
            height: area.height,
          }}
        >
          <span className="picker-size">
            {Math.round(area.width)} × {Math.round(area.height)}
          </span>
        </div>
      ) : (
        <>
          <div className="picker-dim" />
          {image && (
            <p className="picker-hint">
              Drag to pick a section. Esc to cancel.
            </p>
          )}
        </>
      )}
    </div>
  );
}
