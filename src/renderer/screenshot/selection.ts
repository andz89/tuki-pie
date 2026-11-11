import type { ScreenArea } from '../../shared/types';

export interface Point {
  x: number;
  y: number;
}

// Smaller than this is a stray click, not a section.
export const MIN_SECTION_SIZE = 4;

// The box between where the drag started and where the mouse is, whichever
// way the person dragged.
export function areaBetween(start: Point, end: Point): ScreenArea {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function isBigEnough(area: ScreenArea): boolean {
  return area.width >= MIN_SECTION_SIZE && area.height >= MIN_SECTION_SIZE;
}
