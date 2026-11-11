import type { CSSProperties, MouseEvent } from 'react';
import { usePieStore } from '../stores/pie.store';
import { PieAppsFan } from './PieAppsFan';
import { PieScreenshotFan } from './PieScreenshotFan';
import { PieSettingsFan } from './PieSettingsFan';
import { SLICE_ICON_SIZE, SliceIcon } from './icons/SliceIcon';
import type { PieIconName } from './icons/SliceIcon';
import {
  CONTENT_RADIUS,
  INNER_RADIUS,
  PIE_SIZE,
  polarPoint,
  roundedSectorPath,
  sectorPath,
  sliceAngles,
} from './pie-geometry';
import { shortLabel } from './slice-display';

// The icon and label are stacked and centered on the slice, as in the design.
const ICON_OFFSET_Y = -19;
const LABEL_OFFSET_Y = 13.5;

const HOVER_LIFT = 3;

// The lock badge sits on the locked slice's inner edge.
const LOCK_RADIUS = 9;
const LOCK_DISTANCE = INNER_RADIUS + 18;

const pointOf = (event: MouseEvent) => ({ x: event.clientX, y: event.clientY });

interface PieSliceProps {
  index: number;
  count: number;
  label: string;
  description: string;
  icon: PieIconName;
  showsSettingsFan?: boolean;
  showsScreenshotFan?: boolean;
  showsAppsFan?: boolean;
  // Greyed out: there is nothing for it to work on right now.
  disabled?: boolean;
}

export function PieSlice({
  index,
  count,
  label,
  description,
  icon,
  showsSettingsFan = false,
  showsScreenshotFan = false,
  showsAppsFan = false,
  disabled = false,
}: PieSliceProps) {
  // Lit while pointed at, or while its circles stay open after the mouse left.
  const isHovered = usePieStore(
    (state) => (state.hoveredIndex ?? state.openIndex) === index,
  );
  const isOpen = usePieStore((state) => state.openIndex === index);
  const isLocked = usePieStore((state) => state.lockedIndex === index);
  const setHovered = usePieStore((state) => state.setHovered);
  const pressSlice = usePieStore((state) => state.pressSlice);
  const unlock = usePieStore((state) => state.unlock);

  const { start, middle, end } = sliceAngles(index, count);
  const content = polarPoint(middle, CONTENT_RADIUS);
  const lift = polarPoint(middle, HOVER_LIFT);
  const tilePath = roundedSectorPath(start, end);
  const liftStyle = {
    '--lift-x': `${lift.x - PIE_SIZE / 2}px`,
    '--lift-y': `${lift.y - PIE_SIZE / 2}px`,
  } as CSSProperties;

  const handleClick = (event: MouseEvent) => {
    // Without this, the click would also count as a click outside the slices.
    event.stopPropagation();
    pressSlice(index, pointOf(event));
  };
  const lockSpot = polarPoint(middle, LOCK_DISTANCE);

  return (
    <g
      role="menuitem"
      aria-label={`Open ${label} (${description})`}
      aria-disabled={disabled || undefined}
      className={[
        'pie-slice',
        isHovered && 'is-hovered',
        isLocked && 'is-locked',
        disabled && 'is-disabled',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={(event) => setHovered(index, pointOf(event))}
      onMouseLeave={(event) => setHovered(null, pointOf(event))}
      onClick={handleClick}
    >
      <g className="pie-slice-visual" style={liftStyle}>
        <path className="pie-slice-fill" d={tilePath} />
        {/* A separate layer, because a gradient fill can't fade in by itself. */}
        <path className="pie-slice-highlight" d={tilePath} />
        <g className="pie-slice-icon">
          <SliceIcon
            type={icon}
            x={content.x - SLICE_ICON_SIZE / 2}
            y={content.y + ICON_OFFSET_Y}
          />
        </g>
        <text
          className="pie-slice-label"
          x={content.x}
          y={content.y + LABEL_OFFSET_Y}
        >
          {shortLabel(label)}
        </text>
      </g>
      {/* Stays put while the slice moves, so its edge can't flicker the hover. */}
      <path className="pie-slice-hit" d={sectorPath(start, end)} />
      {isLocked && (
        <g
          className="pie-lock"
          role="button"
          aria-label={`Unlock ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            unlock();
          }}
        >
          <circle cx={lockSpot.x} cy={lockSpot.y} r={LOCK_RADIUS} />
          <path
            transform={`translate(${lockSpot.x - 6} ${lockSpot.y - 6.5}) scale(0.5)`}
            d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"
          />
        </g>
      )}
      {showsSettingsFan && isOpen && (
        <PieSettingsFan middle={middle} sliceIndex={index} />
      )}
      {showsScreenshotFan && isOpen && <PieScreenshotFan middle={middle} />}
      {showsAppsFan && isOpen && <PieAppsFan middle={middle} />}
    </g>
  );
}
