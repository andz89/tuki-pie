import type { StoreApi } from 'zustand';
import { PIE_SCALES } from '../../shared/schemas/settings.schema';
import { LIST_EXTRA_WIDTH } from '../../shared/types';
import type { ListSide } from '../../shared/types';
import { bridge } from '../api/bridge';
import { SHORTCUTS_INDEX, SNIPPETS_INDEX } from '../components/slice-display';
import { aimBox, donutHole } from './pie-pointer';
import type { PieState } from './pie.store';
import {
  AIM_HOLD_MS,
  AIM_MIN_MOVE,
  DOUBLE_MS,
  aimsAt,
  inHole,
  isDoublePress,
  pressOutcome,
} from './ring-press';
import type { Point, Press } from './ring-press';
import { useSettingsStore } from './settings.store';

type HoverActions = Pick<
  PieState,
  'opened' | 'setHovered' | 'trackPointer' | 'pressSlice' | 'unlock'
>;

// What the mouse does on the donut: which slice is highlighted and open,
// heading across a slice towards what is open, double-click locks, and the
// room the window makes for a list. `reset` clears it all, for the actions
// that end with the donut closing or moving on.
export function createHover(store: StoreApi<PieState>): {
  reset: () => void;
  actions: HoverActions;
} {
  // Where the mouse was a few pixels ago, to tell which way it is heading.
  let aimFrom: Point | null = null;
  // While the mouse heads for what is open across another slice: the slice
  // that takes over once the hold ends, and the hold's timer.
  let aimTimer: ReturnType<typeof setTimeout> | undefined;
  let aimPending: { index: number | null; at?: Point } | null = null;
  // A lockable slice's click, waiting to see if a second one makes it a
  // double-click.
  let lastPress: Press | null = null;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;

  function endAim() {
    clearTimeout(aimTimer);
    aimTimer = undefined;
    aimPending = null;
  }

  // The list goes on the right, unless the screen ends too soon there.
  function pickListSide(): ListSide {
    if (typeof window === 'undefined') {
      return 'right';
    }
    const scale = PIE_SCALES[useSettingsStore.getState().size];
    const { availWidth } = window.screen;
    const availLeft =
      (window.screen as Screen & { availLeft?: number }).availLeft ?? 0;
    const roomRight =
      availLeft + availWidth - (window.screenX + window.outerWidth);
    return roomRight >= LIST_EXTRA_WIDTH * scale ? 'right' : 'left';
  }

  function setListSide(side: ListSide | null) {
    if (store.getState().listSide === side) {
      return;
    }
    store.setState({ listSide: side });
    void bridge.window.setListSide(side);
  }

  const closeList = () => setListSide(null);

  // Slices that show a list card beside the donut, instead of circles.
  const LIST_SLICES = new Set([SHORTCUTS_INDEX, SNIPPETS_INDEX]);

  // The window is wide while one of them is the open slice.
  function syncList() {
    const { openIndex, listSide } = store.getState();
    setListSide(
      openIndex !== null && LIST_SLICES.has(openIndex)
        ? (listSide ?? pickListSide())
        : null,
    );
  }

  // Nothing marked, open or locked: after an action, or a fresh opening.
  const RESET = {
    hoveredIndex: null,
    openIndex: null,
    lockedIndex: null,
    zipNaming: false,
  };
  function reset() {
    endAim();
    clearTimeout(clickTimer);
    lastPress = null;
    store.setState(RESET);
    closeList();
  }

  // Moving onto a slice (index), or off them all (null) at the point `at`.
  // Off the slices, what is open stays, to come back to, except in the hole in
  // the middle.
  function applyHover(index: number | null, at?: Point) {
    endAim();
    if (index === null) {
      const hole = at ? donutHole() : null;
      store.setState(
        hole && at && inHole(at, hole)
          ? { hoveredIndex: null, openIndex: null }
          : { hoveredIndex: null },
      );
    } else {
      store.setState({
        hoveredIndex: index,
        openIndex: index,
        error: null,
      });
    }
    syncList();
  }

  const actions: HoverActions = {
    // Main says the window is opening. An unpinned donut starts fresh. A pinned
    // one keeps what it shows, but main made its window a square again (at the
    // cursor), so a list still open asks for its room again.
    opened: () => {
      if (useSettingsStore.getState().pin !== 'pinned') {
        reset();
        return;
      }
      store.setState({ listSide: null });
      syncList();
    },

    // A message stays up when the mouse leaves, and goes when it points elsewhere.
    // While a slice is locked, nothing else answers the mouse. Heading for what
    // is open across another slice, that slice takes over only after a moment.
    setHovered: (index, at) => {
      const { lockedIndex, openIndex } = store.getState();
      if (lockedIndex !== null) {
        return;
      }
      if (index === openIndex || index === null || openIndex === null || !at) {
        if (aimTimer !== undefined && index !== openIndex) {
          aimPending = { index, at };
          return;
        }
        applyHover(index, at);
        return;
      }
      const box = aimBox();
      const hole = donutHole();
      const heading =
        box &&
        hole &&
        aimFrom &&
        (Math.hypot(at.x - aimFrom.x, at.y - aimFrom.y) < AIM_MIN_MOVE ||
          aimsAt(aimFrom, at, box, hole));
      if (!heading) {
        applyHover(index, at);
        return;
      }
      aimPending = { index, at };
      // Once, when the hold starts: then what is under the mouse takes over.
      aimTimer ??= setTimeout(() => {
        const pending = aimPending;
        aimTimer = undefined;
        if (pending && store.getState().lockedIndex === null) {
          applyHover(pending.index, pending.at);
        }
      }, AIM_HOLD_MS);
    },

    trackPointer: (at) => {
      if (
        !aimFrom ||
        Math.hypot(at.x - aimFrom.x, at.y - aimFrom.y) >= AIM_MIN_MOVE
      ) {
        aimFrom = at;
      }
    },

    // A click on a slice. A double-click on one with circles or a list locks
    // it, so its single click waits a moment first.
    pressSlice: (index, at) => {
      const press = { index, ...at, at: Date.now() };
      const isDouble = isDoublePress(lastPress, press);
      lastPress = isDouble ? null : press;
      const outcome = pressOutcome(
        store.getState().lockedIndex,
        index,
        isDouble,
      );
      if (outcome !== 'wait') {
        clearTimeout(clickTimer);
      }
      if (outcome === 'lock') {
        endAim();
        store.setState({
          lockedIndex: index,
          hoveredIndex: index,
          openIndex: index,
        });
        syncList();
      } else if (outcome === 'unlock') {
        store.getState().unlock();
        applyHover(index, at);
      } else if (outcome === 'wait') {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(
          () => store.getState().openRingItem(index),
          DOUBLE_MS,
        );
      } else if (outcome === 'run') {
        store.getState().openRingItem(index);
      }
    },

    unlock: () => store.setState({ lockedIndex: null }),
  };

  return { reset, actions };
}
