import type { CSSProperties } from 'react';
import type { OrbitLevel } from './center-content';

// Angles are in degrees, sizes in pixels, and times in seconds. The rings lean
// nearly the same way so they swirl together. The laps differ so that they
// never line up the same way twice.
const RINGS = [
  { angle: -22, tilt: 70, size: 120, lap: 7, start: 0 },
  { angle: -12, tilt: 64, size: 106, lap: 9.5, start: 3 },
  { angle: -30, tilt: 60, size: 94, lap: 8.2, start: 5 },
  { angle: -4, tilt: 72, size: 112, lap: 11, start: 1.5 },
];

// Positions are percentages of the hub.
const SPARKS = [
  { x: 26, y: 36, start: 0 },
  { x: 71, y: 28, start: 1.1 },
  { x: 80, y: 60, start: 2.3 },
  { x: 38, y: 74, start: 0.6 },
  { x: 58, y: 48, start: 1.7 },
];

export function PieOrbit({ level }: { level: OrbitLevel }) {
  return (
    <div className="pie-orbit" data-level={level} aria-hidden="true">
      <div className="pie-orbit-bloom" />
      {RINGS.map(({ angle, tilt, size, lap, start }) => (
        <div
          key={angle}
          className="pie-orbit-ring"
          style={
            {
              '--angle': `${angle}deg`,
              '--tilt': `${tilt}deg`,
              '--size': `${size}px`,
              '--lap': `${lap}s`,
              '--start': `${start}s`,
            } as CSSProperties
          }
        >
          <div className="pie-orbit-arc is-glow" />
          <div className="pie-orbit-arc" />
        </div>
      ))}
      {SPARKS.map(({ x, y, start }) => (
        <div
          key={`${x}-${y}`}
          className="pie-orbit-spark"
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              '--start': `${start}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
