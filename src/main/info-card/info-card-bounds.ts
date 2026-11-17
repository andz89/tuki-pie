import type { InfoCardLayout } from '../../shared/schemas/info-card.schema';

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SIDEBAR_WIDTH = 340;
// The card sits 6px in from the window's edges (info-card.css), so the bar
// is a little taller than its content.
export const BAR_HEIGHT = 140;

export const LIST_WIDTH = 420;

// The Links and Images cards: always down the right edge, wider than the
// sidebar, as a list does not fit a bar.
export function listCardBounds(work: Area): Area {
  const width = Math.min(LIST_WIDTH, work.width);
  return {
    x: work.x + work.width - width,
    y: work.y,
    width,
    height: work.height,
  };
}

// Where the card goes in the screen's work area (the screen less the
// taskbar): down the right edge, or across the top or bottom.
export function infoCardBounds(layout: InfoCardLayout, work: Area): Area {
  if (layout === 'sidebar') {
    const width = Math.min(SIDEBAR_WIDTH, work.width);
    return {
      x: work.x + work.width - width,
      y: work.y,
      width,
      height: work.height,
    };
  }
  const height = Math.min(BAR_HEIGHT, work.height);
  const y = layout === 'top' ? work.y : work.y + work.height - height;
  return { x: work.x, y, width: work.width, height };
}
