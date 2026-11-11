import { globalShortcut } from 'electron';
import { UiohookKey, uIOhook } from 'uiohook-napi';
import {
  dismissPieWindow,
  isPieWindowOpen,
  showPieWindowAtCursor,
} from '../windows/pie-window';
import { createCtrlShiftClickDetector } from './ctrl-shift-click';
import { onOpenKeysPressed } from './open-keys';

// Ctrl and Shift may or may not still be held when the mouse button comes up.
const FOCUS_KEYS = ['F24', 'Ctrl+F24', 'Shift+F24', 'Ctrl+Shift+F24'];

let canTakeFocus = false;

// Windows only lets an app take focus right after it receives input, and a
// background mouse listener doesn't count. So the app presses an unused key
// that only it listens for, and opens the donut in response to that key.
function openWithFocus(): void {
  uIOhook.keyTap(UiohookKey.F24);
}

// Opens the donut at the mouse, from anything that isn't a key press of ours,
// such as the Windows right-click menu.
export function openPieAtCursor(): void {
  if (canTakeFocus) {
    openWithFocus();
  } else {
    showPieWindowAtCursor();
  }
}

function togglePie(): void {
  if (isPieWindowOpen()) {
    dismissPieWindow();
  } else {
    // A registered key press already lets the app take focus.
    showPieWindowAtCursor();
  }
}

export function startShortcuts(): void {
  canTakeFocus = FOCUS_KEYS.every((key) =>
    globalShortcut.register(key, showPieWindowAtCursor),
  );

  onOpenKeysPressed(togglePie);

  const detector = createCtrlShiftClickDetector({
    isOpen: isPieWindowOpen,
    open: openPieAtCursor,
    close: dismissPieWindow,
  });

  uIOhook.on('mousedown', detector.mouseDown);
  uIOhook.on('mouseup', detector.mouseUp);
  uIOhook.start();
}

export function stopShortcuts(): void {
  globalShortcut.unregisterAll();
  uIOhook.stop();
}
