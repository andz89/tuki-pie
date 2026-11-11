// All measurements are in pixels, inside a 340 x 340 drawing.
export const PIE_SIZE = 340;
export const CONTENT_RADIUS = 120;

// The Settings circle overlaps the ring slightly, so the mouse can move onto it
// without ever leaving the slice.
export const BUBBLE_DISTANCE = 190;
export const BUBBLE_RADIUS = 24;
const FAN_STEP_DEGREES = 20;

const CENTER = PIE_SIZE / 2;
export const OUTER_RADIUS = 170;
export const INNER_RADIUS = 70;

// The visible tile sits inside the slice's mouse area, centered on CONTENT_RADIUS.
export const TILE_OUTER_RADIUS = 166;
export const TILE_INNER_RADIUS = 74;
export const TILE_CORNER_RADIUS = 14;
export const TILE_GAP = 4;

export interface Point {
  x: number;
  y: number;
}

// Angles are in degrees, clockwise, with 0 pointing straight up.
export function sliceAngles(index: number, count: number) {
  const step = 360 / count;
  const middle = index * step;
  return { start: middle - step / 2, middle, end: middle + step / 2 };
}

export function polarPoint(angle: number, radius: number): Point {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(radians),
    y: CENTER - radius * Math.cos(radians),
  };
}

function svgPoint(angle: number, radius: number): string {
  const { x, y } = polarPoint(angle, radius);
  return `${Math.round(x * 1000) / 1000} ${Math.round(y * 1000) / 1000}`;
}

// Where a row of circles sits, centered on one angle.
export function fanAngles(middle: number, count: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => middle + (index - (count - 1) / 2) * FAN_STEP_DEGREES,
  );
}

// The SVG path for one ring segment between two angles.
export function sectorPath(
  start: number,
  end: number,
  innerRadius = INNER_RADIUS,
  outerRadius = OUTER_RADIUS,
): string {
  // A full row of circles spans more than a half circle.
  const largeArc = end - start > 180 ? 1 : 0;
  return [
    `M ${svgPoint(start, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${svgPoint(end, outerRadius)}`,
    `L ${svgPoint(end, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${svgPoint(start, innerRadius)}`,
    'Z',
  ].join(' ');
}

// A point `along` the line at this angle, moved `offset` px clockwise off it.
function sidePoint(angle: number, along: number, offset: number): string {
  const onLine = polarPoint(angle, along);
  const sideways = polarPoint(angle + 90, offset);
  const x = onLine.x + sideways.x - CENTER;
  const y = onLine.y + sideways.y - CENTER;
  return `${Math.round(x * 1000) / 1000} ${Math.round(y * 1000) / 1000}`;
}

// One slice's visible tile. Its sides run parallel, so the gap to the next tile
// is the same width near the hub as it is at the rim.
export function roundedSectorPath(start: number, end: number): string {
  const outer = TILE_OUTER_RADIUS;
  const inner = TILE_INNER_RADIUS;
  const corner = TILE_CORNER_RADIUS;
  const halfGap = TILE_GAP / 2;

  // How far each corner's circle sits from the slice's edge.
  const cornerOffset = halfGap + corner;
  const outerCenter = outer - corner;
  const innerCenter = inner + corner;
  const outerAlong = Math.sqrt(outerCenter ** 2 - cornerOffset ** 2);
  const innerAlong = Math.sqrt(innerCenter ** 2 - cornerOffset ** 2);
  const outerSpread = degrees(Math.asin(cornerOffset / outerCenter));
  const innerSpread = degrees(Math.asin(cornerOffset / innerCenter));

  const cornerArc = `A ${corner} ${corner} 0 0 1`;
  return [
    `M ${sidePoint(start, outerAlong, halfGap)}`,
    `${cornerArc} ${svgPoint(start + outerSpread, outer)}`,
    `A ${outer} ${outer} 0 0 1 ${svgPoint(end - outerSpread, outer)}`,
    `${cornerArc} ${sidePoint(end, outerAlong, -halfGap)}`,
    `L ${sidePoint(end, innerAlong, -halfGap)}`,
    `${cornerArc} ${svgPoint(end - innerSpread, inner)}`,
    `A ${inner} ${inner} 0 0 0 ${svgPoint(start + innerSpread, inner)}`,
    `${cornerArc} ${sidePoint(start, innerAlong, halfGap)}`,
    'Z',
  ].join(' ');
}

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
