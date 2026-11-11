import type { UiohookMouseEvent } from 'uiohook-napi';

type MouseInput = Pick<
  UiohookMouseEvent,
  'button' | 'x' | 'y' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
>;

interface CtrlShiftClickActions {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
}

const LEFT_BUTTON = 1;

// A hand rarely holds perfectly still during a click. Further than this is a drag.
const MAX_CLICK_TRAVEL = 6;

function isCtrlShiftLeftPress(input: MouseInput): boolean {
  return (
    input.button === LEFT_BUTTON &&
    input.ctrlKey &&
    input.shiftKey &&
    !input.altKey &&
    !input.metaKey
  );
}

export function createCtrlShiftClickDetector({
  isOpen,
  open,
  close,
}: CtrlShiftClickActions) {
  let press: { x: number; y: number; wasOpen: boolean } | null = null;

  return {
    mouseDown(input: MouseInput): void {
      press = isCtrlShiftLeftPress(input)
        ? { x: input.x, y: input.y, wasOpen: isOpen() }
        : null;
    },

    // Acting on release lets the app under the mouse finish handling its click,
    // so it can't take focus away from the donut straight after it opens.
    mouseUp(input: MouseInput): void {
      if (input.button !== LEFT_BUTTON || !press) {
        return;
      }

      const { x, y, wasOpen } = press;
      press = null;
      if (Math.hypot(input.x - x, input.y - y) > MAX_CLICK_TRAVEL) {
        return;
      }

      if (wasOpen) {
        close();
      } else {
        open();
      }
    },
  };
}
