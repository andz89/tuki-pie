import {
  APPS_INDEX,
  SCREENSHOT_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
  SNIPPETS_INDEX,
} from '../components/slice-display';

// --- Double-click to lock ------------------------------------------------------
// A double-click on a slice that opens circles or a list locks it: its circles
// or list stay, and the other slices no longer answer the mouse or a click.
// A double-click anywhere on the donut, its lock badge, or Esc unlocks it.

export const DOUBLE_MS = 400;
const DOUBLE_MOVE = 8;

export interface Press {
  index: number;
  x: number;
  y: number;
  at: number;
}

// The second press of a double-click: soon, close by, on the same slice.
export function isDoublePress(last: Press | null, press: Press): boolean {
  return (
    last !== null &&
    press.at - last.at < DOUBLE_MS &&
    Math.hypot(press.x - last.x, press.y - last.y) < DOUBLE_MOVE &&
    last.index === press.index
  );
}

// Slices with circles or a list of their own. Page Info has neither.
const LOCKABLE = new Set([
  SCREENSHOT_INDEX,
  SNIPPETS_INDEX,
  SHORTCUTS_INDEX,
  APPS_INDEX,
  SETTINGS_INDEX,
]);

export const isLockable = (index: number) => LOCKABLE.has(index);

export type PressOutcome =
  | 'lock'
  | 'unlock'
  // Another slice than the locked one: nothing happens.
  | 'ignore'
  // A lockable slice's click waits, in case it is the first of a double-click.
  | 'wait'
  | 'run';

export function pressOutcome(
  lockedIndex: number | null,
  index: number,
  isDouble: boolean,
): PressOutcome {
  if (isDouble) {
    if (isLockable(index) && lockedIndex !== index) {
      return 'lock';
    }
    return lockedIndex === null ? 'ignore' : 'unlock';
  }
  if (lockedIndex !== null && index !== lockedIndex) {
    return 'ignore';
  }
  return isLockable(index) ? 'wait' : 'run';
}

// --- Aiming at what is open ----------------------------------------------------
// On the way from a slice to its circles or list, the mouse may cross a
// neighboring slice. If it is heading for them, that slice takes over only
// after a moment (AIM_HOLD_MS).

export const AIM_HOLD_MS = 250;
export const AIM_MIN_MOVE = 4;
const AIM_REACH = 320;
const AIM_STEP = 6;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Hole {
  center: Point;
  radius: number;
}

export const inHole = (at: Point, hole: Hole) =>
  Math.hypot(at.x - hole.center.x, at.y - hole.center.y) < hole.radius;

// Whether the line from `from` through `to` reaches the box further along,
// without crossing the hole in the donut's middle.
export function aimsAt(from: Point, to: Point, box: Box, hole: Hole): boolean {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!length) {
    return false;
  }
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  for (let along = 0; along <= AIM_REACH; along += AIM_STEP) {
    const point = { x: to.x + ux * along, y: to.y + uy * along };
    if (inHole(point, hole)) {
      return false;
    }
    if (
      point.x >= box.left &&
      point.x <= box.right &&
      point.y >= box.top &&
      point.y <= box.bottom
    ) {
      return true;
    }
  }
  return false;
}
