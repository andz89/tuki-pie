import { useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { usePieStore } from '../stores/pie.store';
import { createDragTracker } from './drag-tracker';

const LEFT_BUTTON = 0;
const ONLY_LEFT_BUTTON_HELD = 1;

// Press anywhere on the donut and move to drag it. A press that doesn't travel
// stays a normal click, so slices keep working.
export function usePieDrag() {
  const moveWindowBy = usePieStore((state) => state.moveWindowBy);
  const [tracker] = useState(() => createDragTracker(moveWindowBy));
  const justDragged = useRef(false);

  return {
    onPointerDown: (event: PointerEvent) => {
      justDragged.current = false;
      if (event.button === LEFT_BUTTON) {
        tracker.press(event.screenX, event.screenY);
      }
    },

    onPointerMove: (event: PointerEvent) => {
      if (event.buttons !== ONLY_LEFT_BUTTON_HELD) {
        tracker.release();
        return;
      }
      if (tracker.move(event.screenX, event.screenY)) {
        // Keeps the drag going if the pointer briefly outruns the window.
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },

    onPointerUp: () => {
      justDragged.current = tracker.release();
    },

    onPointerCancel: () => {
      tracker.release();
    },

    // Letting go after a drag also fires a click, which must not close the donut.
    onClickCapture: (event: MouseEvent) => {
      if (justDragged.current) {
        justDragged.current = false;
        event.stopPropagation();
      }
    },
  };
}
