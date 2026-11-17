import type { StoreApi } from 'zustand';
import { bridge } from '../api/bridge';
import {
  APPS_INDEX,
  INFO_CARD_INDEX,
  NOTES_INDEX,
  PAGE_INFO_INDEX,
  SCREENSHOT_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
  SNIPPETS_INDEX,
  ZIP_INDEX,
} from '../components/slice-display';
import type { PieState } from './pie.store';

type WindowActions = Pick<
  PieState,
  | 'moveWindowBy'
  | 'changeVolume'
  | 'openRingItem'
  | 'openShortcut'
  | 'openSettings'
  | 'openPageInfo'
  | 'openNotes'
  | 'openInfoCard'
  | 'takeScreenshot'
  | 'openShortcutForm'
  | 'close'
  | 'dismiss'
>;

// What the donut asks the main process to do: open a window, a shortcut or
// a screenshot, move itself, change the volume, close.
export function createWindowActions(
  store: StoreApi<PieState>,
  reset: () => void,
): WindowActions {
  // Drag and wheel events come far faster than the screen redraws, and each
  // one used to be its own message to the main process. The first of a frame
  // goes at once; the rest of that frame is added up (moves) or dropped
  // (volume steps, so a touchpad can't fire dozens of key presses).
  const FRAME_MS = 16;
  let moveTimer: ReturnType<typeof setTimeout> | undefined;
  let movedLater = { x: 0, y: 0 };
  let volumeTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    moveWindowBy: (deltaX, deltaY) => {
      if (moveTimer !== undefined) {
        movedLater = { x: movedLater.x + deltaX, y: movedLater.y + deltaY };
        return;
      }
      void bridge.window.moveBy(deltaX, deltaY);
      const endFrame = () => {
        const { x, y } = movedLater;
        movedLater = { x: 0, y: 0 };
        if (x === 0 && y === 0) {
          moveTimer = undefined;
          return;
        }
        void bridge.window.moveBy(x, y);
        moveTimer = setTimeout(endFrame, FRAME_MS);
      };
      moveTimer = setTimeout(endFrame, FRAME_MS);
    },

    changeVolume: (change) => {
      // A click on mute always counts.
      if (change !== 'mute') {
        if (volumeTimer !== undefined) {
          return;
        }
        volumeTimer = setTimeout(() => {
          volumeTimer = undefined;
        }, FRAME_MS);
      }
      void bridge.window.volume(change);
    },

    openRingItem: (index) => {
      // Picking a part is what people want most, so the slice itself does that.
      if (index === SCREENSHOT_INDEX) {
        void store.getState().takeScreenshot('section');
      } else if (index === SNIPPETS_INDEX) {
        store.getState().openShortcutForm({ kind: 'snippets-section' });
      } else if (index === SHORTCUTS_INDEX) {
        store.getState().openShortcutForm({ kind: 'section' });
      } else if (index === APPS_INDEX) {
        store.getState().openShortcutForm({ kind: 'apps-section' });
      } else if (index === PAGE_INFO_INDEX) {
        store.getState().openPageInfo();
      } else if (index === INFO_CARD_INDEX) {
        store.getState().openInfoCard();
      } else if (index === NOTES_INDEX) {
        store.getState().openNotes();
      } else if (index === ZIP_INDEX) {
        store.getState().startZip();
      } else if (index === SETTINGS_INDEX) {
        store.getState().openSettings();
      }
    },

    openShortcut: async (id) => {
      const result = await bridge.shortcuts.open(id);
      reset();
      if (result.ok) {
        store.getState().dismiss();
      } else {
        store.setState({ error: result.error });
      }
    },

    openSettings: () => {
      reset();
      store.setState({ error: null, circleHint: null });
      void bridge.window.openSettings();
    },

    openPageInfo: () => {
      reset();
      store.setState({ error: null, circleHint: null });
      void bridge.window.openPageInfo();
    },

    openNotes: () => {
      reset();
      store.setState({ error: null, circleHint: null });
      void bridge.window.openNotes();
    },

    openInfoCard: () => {
      reset();
      store.setState({ error: null, circleHint: null });
      void bridge.window.openInfoCard();
    },

    // The donut steps aside on its own, so it isn't in the picture.
    takeScreenshot: async (mode) => {
      reset();
      store.setState({ error: null, circleHint: null });
      const result = await bridge.screenshot.take(mode);
      if (!result.ok) {
        store.setState({ error: result.error });
      }
    },

    openShortcutForm: (request) => {
      reset();
      store.setState({ error: null, circleHint: null });
      void bridge.window.openShortcutForm(request);
    },

    close: () => {
      reset();
      store.setState({ error: null, circleHint: null });
      void bridge.window.hide();
    },

    // The main process knows whether the donut is pinned, even if that changed
    // in the settings window a moment ago.
    dismiss: () => {
      store.setState({ error: null });
      void bridge.window.dismiss();
    },
  };
}
