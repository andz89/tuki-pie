import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent, WheelEvent } from 'react';
import { usePieStore } from '../stores/pie.store';
import { SLICE_ICON_SIZE, SliceIcon } from './icons/SliceIcon';
import type { PieIconName } from './icons/SliceIcon';
import {
  BUBBLE_DISTANCE,
  BUBBLE_RADIUS,
  fanAngles,
  polarPoint,
  sectorPath,
} from './pie-geometry';

// An invisible strip behind the circles, so the mouse can travel between them
// without crossing a neighboring slice and closing the fan.
const BAND_INNER_RADIUS = 168;
const BAND_OUTER_RADIUS = 216;
const BAND_EXTRA_DEGREES = 10;

const FAN_IMAGE_SIZE = 28;

export interface FanCircle {
  id: string;
  icon?: PieIconName;
  letter?: string;
  // A picture inside the circle, such as an app's own icon.
  image?: string;
  label: string;
  value: string;
  isOn?: boolean;
  onClick: () => void;
  onWheel?: (event: WheelEvent) => void;
  onEnter?: () => void;
  onLeave?: () => void;
}

interface PieFanRowProps {
  className: string;
  middle: number;
  circles: FanCircle[];
}

export function PieFanRow({ className, middle, circles }: PieFanRowProps) {
  const setCircleHint = usePieStore((state) => state.setCircleHint);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastClick, setLastClick] = useState({ id: '', count: 0 });
  const angles = fanAngles(middle, circles.length);

  const active = circles.find((circle) => circle.id === activeId);
  const hintLabel = active?.label;
  const hintValue = active?.value;

  useEffect(() => {
    setCircleHint(
      hintLabel && hintValue ? { label: hintLabel, value: hintValue } : null,
    );
  }, [hintLabel, hintValue, setCircleHint]);

  useEffect(() => () => setCircleHint(null), [setCircleHint]);

  return (
    <g className={className}>
      <path
        className="pie-fan-band pie-aim-target"
        d={sectorPath(
          angles[0] - BAND_EXTRA_DEGREES,
          // An arc that closes on itself draws nothing, so a full ring stops
          // just short of 360 degrees.
          Math.min(
            angles[circles.length - 1] + BAND_EXTRA_DEGREES,
            angles[0] - BAND_EXTRA_DEGREES + 359.9,
          ),
          BAND_INNER_RADIUS,
          BAND_OUTER_RADIUS,
        )}
      />
      {circles.map((circle, index) => {
        const center = polarPoint(angles[index], BUBBLE_DISTANCE);
        const handleClick = (event: MouseEvent) => {
          // The slice underneath has its own click, which opens the panel.
          event.stopPropagation();
          setLastClick(({ count }) => ({ id: circle.id, count: count + 1 }));
          circle.onClick();
        };
        const wasClicked = lastClick.id === circle.id;

        return (
          <g
            key={circle.id}
            className={[
              'pie-fan-circle',
              circle.id === activeId && 'is-active',
              circle.isOn && 'is-on',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ '--i': index } as CSSProperties}
            role="menuitem"
            aria-label={`${circle.label}: ${circle.value}`}
            onMouseEnter={() => {
              setActiveId(circle.id);
              circle.onEnter?.();
            }}
            onMouseLeave={() => {
              setActiveId(null);
              circle.onLeave?.();
            }}
            onClick={handleClick}
            onWheel={circle.onWheel}
          >
            <circle cx={center.x} cy={center.y} r={BUBBLE_RADIUS} />
            {/* A new key on each click replays the tilt. */}
            <g
              key={wasClicked ? lastClick.count : 'still'}
              className={
                wasClicked ? 'pie-fan-icon is-clicked' : 'pie-fan-icon'
              }
            >
              {circle.image ? (
                <image
                  className="pie-fan-image"
                  href={circle.image}
                  x={center.x - FAN_IMAGE_SIZE / 2}
                  y={center.y - FAN_IMAGE_SIZE / 2}
                  width={FAN_IMAGE_SIZE}
                  height={FAN_IMAGE_SIZE}
                />
              ) : circle.icon ? (
                <SliceIcon
                  type={circle.icon}
                  x={center.x - SLICE_ICON_SIZE / 2}
                  y={center.y - SLICE_ICON_SIZE / 2}
                />
              ) : (
                <text className="pie-fan-letter" x={center.x} y={center.y}>
                  {circle.letter}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
