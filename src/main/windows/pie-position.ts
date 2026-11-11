import type { Point, Rectangle } from 'electron';

// At normal size the donut is 340 px wide. The extra space keeps its soft
// shadow from being cut off.
export const WINDOW_SIZE = 480;

// The donut plus the 44 px the Settings circles can pop out past its edge.
const VISIBLE_SIZE = 428;

function clampToAxis(
  position: number,
  start: number,
  length: number,
  scale: number,
): number {
  const visible = VISIBLE_SIZE * scale;
  const inset = (Math.round(WINDOW_SIZE * scale) - visible) / 2;
  const lowest = start - inset;
  const highest = start + length - visible - inset;
  return Math.round(Math.min(Math.max(position, lowest), highest));
}

// Centers the donut on the mouse. Only the visible part has to fit on the
// screen: the see-through space around it is allowed to hang over the edge.
export function pieWindowBounds(
  cursor: Point,
  workArea: Rectangle,
  scale = 1,
): Rectangle {
  const side = Math.round(WINDOW_SIZE * scale);
  return {
    x: clampToAxis(cursor.x - side / 2, workArea.x, workArea.width, scale),
    y: clampToAxis(cursor.y - side / 2, workArea.y, workArea.height, scale),
    width: side,
    height: side,
  };
}
