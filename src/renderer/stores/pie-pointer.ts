import { INNER_RADIUS, PIE_SIZE } from '../components/pie-geometry';
import type { Box, Hole } from './ring-press';

// The hole in the donut's middle, on screen, at whatever size it is drawn.
export function donutHole(): Hole | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const menu = document.querySelector('.pie-menu');
  if (!menu) {
    return null;
  }
  const { left, top, width, height } = menu.getBoundingClientRect();
  return {
    center: { x: left + width / 2, y: top + height / 2 },
    radius: INNER_RADIUS * (width / PIE_SIZE),
  };
}

// What is open beside the donut: the Shortcuts list, or a row of circles.
export function aimBox(): Box | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return (
    document.querySelector('.pie-aim-target')?.getBoundingClientRect() ?? null
  );
}
