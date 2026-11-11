import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { usePieStore } from '../stores/pie.store';

// The donut's own click opens the settings window, and a press starts a drag.
const keepToList = (event: MouseEvent | PointerEvent) =>
  event.stopPropagation();

interface PieListCardProps {
  sliceIndex: number;
  label: string;
  children: ReactNode;
  foot: ReactNode;
}

// The card a slice shows as a list, beside the donut in the space the window
// gains while it is open.
export function PieListCard({
  sliceIndex,
  label,
  children,
  foot,
}: PieListCardProps) {
  const setHovered = usePieStore((state) => state.setHovered);

  return (
    <div className="pie-list-dock">
      <div
        className="pie-list pie-aim-target"
        role="menu"
        aria-label={label}
        // Being on the list counts as pointing at its slice.
        onMouseEnter={() => setHovered(sliceIndex)}
        onMouseLeave={(event) =>
          setHovered(null, { x: event.clientX, y: event.clientY })
        }
        onPointerDown={keepToList}
        onClick={keepToList}
      >
        <ul className="pie-list-items">{children}</ul>
        <div className="pie-list-foot">{foot}</div>
      </div>
    </div>
  );
}
