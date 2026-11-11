import { describe, expect, it } from 'vitest';
import {
  BUBBLE_DISTANCE,
  BUBBLE_RADIUS,
  fanAngles,
  TILE_CORNER_RADIUS,
  TILE_GAP,
  TILE_INNER_RADIUS,
  TILE_OUTER_RADIUS,
  polarPoint,
  roundedSectorPath,
  sectorPath,
  sliceAngles,
} from './pie-geometry';

describe('sliceAngles', () => {
  it('centers the first slice at the top', () => {
    expect(sliceAngles(0, 8)).toEqual({ start: -22.5, middle: 0, end: 22.5 });
  });

  it('goes clockwise, so the third of eight slices points right', () => {
    expect(sliceAngles(2, 8).middle).toBe(90);
  });

  it.each([2, 3, 5, 8])('leaves no gap between %i slices', (count) => {
    for (let index = 0; index < count - 1; index++) {
      expect(sliceAngles(index, count).end).toBe(
        sliceAngles(index + 1, count).start,
      );
    }
    expect(sliceAngles(count - 1, count).end - 360).toBeCloseTo(
      sliceAngles(0, count).start,
    );
  });
});

describe('polarPoint', () => {
  it('puts 0 degrees straight above the center', () => {
    const point = polarPoint(0, 120);
    expect(point.x).toBeCloseTo(170);
    expect(point.y).toBeCloseTo(50);
  });

  it('puts 90 degrees straight right of the center', () => {
    const point = polarPoint(90, 120);
    expect(point.x).toBeCloseTo(290);
    expect(point.y).toBeCloseTo(170);
  });
});

describe('Settings circle', () => {
  it('touches the ring, so the mouse never crosses a gap to reach it', () => {
    expect(BUBBLE_DISTANCE - BUBBLE_RADIUS).toBeLessThanOrEqual(170);
  });

  it('fits inside the 480 px window at every angle', () => {
    expect(BUBBLE_DISTANCE + BUBBLE_RADIUS).toBeLessThanOrEqual(240);
  });
});

describe('fanAngles', () => {
  it('centers the row of circles on the Settings slice', () => {
    expect(fanAngles(320, 5)).toEqual([280, 300, 320, 340, 360]);
  });

  it('spaces the circles so they do not overlap', () => {
    const [first, second] = fanAngles(320, 5).map((angle) =>
      polarPoint(angle, BUBBLE_DISTANCE),
    );
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(
      BUBBLE_RADIUS * 2,
    );
  });
});

describe('sectorPath with custom radii', () => {
  it('can draw a band outside the ring', () => {
    expect(sectorPath(-22.5, 22.5, 168, 216)).toContain('A 216 216 0 0 1');
    expect(sectorPath(-22.5, 22.5, 168, 216)).toContain('A 168 168 0 0 0');
  });
});

// The point each move, line, or arc of a path ends on.
function pathEndpoints(path: string) {
  return [...path.matchAll(/(?:[ML]|A \S+ \S+ 0 0 [01]) (\S+) (\S+)/g)].map(
    ([, x, y]) => ({ x: Number(x), y: Number(y) }),
  );
}

describe('roundedSectorPath', () => {
  it('rounds all four corners', () => {
    const corner = `A ${TILE_CORNER_RADIUS} ${TILE_CORNER_RADIUS} 0 0 1`;
    expect(roundedSectorPath(0, 90).split(corner)).toHaveLength(5);
  });

  it('draws the outer edge clockwise and the inner edge back', () => {
    const tile = roundedSectorPath(0, 90);
    expect(tile).toContain(`A ${TILE_OUTER_RADIUS} ${TILE_OUTER_RADIUS} 0 0 1`);
    expect(tile).toContain(`A ${TILE_INNER_RADIUS} ${TILE_INNER_RADIUS} 0 0 0`);
  });

  it('stays between the inner and outer radius', () => {
    for (const { x, y } of pathEndpoints(roundedSectorPath(-45, 45))) {
      const radius = Math.hypot(x - 170, y - 170);
      expect(radius).toBeGreaterThanOrEqual(TILE_INNER_RADIUS - 0.01);
      expect(radius).toBeLessThanOrEqual(TILE_OUTER_RADIUS + 0.01);
    }
  });

  it('leaves half the gap on each side, at every radius', () => {
    // This slice runs from straight up to straight right of the center.
    const points = pathEndpoints(roundedSectorPath(0, 90));
    expect(points).toHaveLength(8);
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(170 + TILE_GAP / 2 - 0.01);
      expect(y).toBeLessThanOrEqual(170 - TILE_GAP / 2 + 0.01);
    }
  });

  it('fits inside the area that takes the mouse', () => {
    expect(TILE_INNER_RADIUS).toBeGreaterThanOrEqual(70);
    expect(TILE_OUTER_RADIUS).toBeLessThanOrEqual(170);
  });
});

describe('sectorPath', () => {
  it('draws the top slice of eight as a ring segment', () => {
    expect(sectorPath(-22.5, 22.5)).toBe(
      'M 104.944 12.94 A 170 170 0 0 1 235.056 12.94 L 196.788 105.328 A 70 70 0 0 0 143.212 105.328 Z',
    );
  });

  it('keeps the short arc for a half-circle slice', () => {
    expect(sectorPath(-90, 90)).toContain('A 170 170 0 0 1');
  });

  it('takes the long way round for a band wider than a half circle', () => {
    const band = sectorPath(-100, 100, 168, 216);
    expect(band).toContain('A 216 216 0 1 1');
    expect(band).toContain('A 168 168 0 1 0');
  });
});
