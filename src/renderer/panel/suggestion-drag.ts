import type { DragEvent } from 'react';

// Dragging in the Suggestions tab, as in Tuki. A spot is { at, index }: `at`
// is the group a value sits in, or 'groups' for the groups themselves, so
// values move between groups but never land among the groups.
export interface DragSpot {
  at: string;
  index: number;
}

export interface SuggestionDrag {
  list: 'groups' | 'values';
  from: DragSpot;
  over: DragSpot | null;
}

export type DropMark = 'dragging' | 'before' | 'after' | null;

export const GROUPS_SPOT = 'groups';

export const isSameSpot = (a: DragSpot | null, b: DragSpot | null): boolean =>
  a !== null && b !== null && a.at === b.at && a.index === b.index;

// Before the row in its top half, after it in its bottom half.
export function dropSpot(
  at: string,
  index: number,
  clientY: number,
  rect: { top: number; height: number },
): DragSpot {
  return {
    at,
    index: clientY > rect.top + rect.height / 2 ? index + 1 : index,
  };
}

// How the row at `index` in `at` looks during a drag.
export function dropMark(
  drag: SuggestionDrag | null,
  list: SuggestionDrag['list'],
  at: string,
  index: number,
): DropMark {
  if (drag?.list !== list) {
    return null;
  }
  if (isSameSpot(drag.from, { at, index })) {
    return 'dragging';
  }
  if (drag.over?.at !== at) {
    return null;
  }
  if (drag.over.index === index) {
    return 'before';
  }
  return drag.over.index === index + 1 ? 'after' : null;
}

interface DragPropsOptions {
  list: SuggestionDrag['list'];
  at: string;
  index: number;
  drag: SuggestionDrag | null;
  setDrag: (drag: SuggestionDrag | null) => void;
  onMove: (from: DragSpot, to: DragSpot) => void;
}

// Shows where a drag would land; false when the drag isn't one for here.
export function markOver(
  event: DragEvent,
  drag: SuggestionDrag | null,
  setDrag: (drag: SuggestionDrag | null) => void,
  list: SuggestionDrag['list'],
  over: DragSpot,
): boolean {
  if (drag?.list !== list) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  if (!isSameSpot(over, drag.over)) {
    setDrag({ ...drag, over });
  }
  return true;
}

// The handle starts a drag; the target takes drops before or after it.
export function dragProps({
  list,
  at,
  index,
  drag,
  setDrag,
  onMove,
}: DragPropsOptions) {
  const spot = (event: DragEvent) =>
    dropSpot(
      at,
      index,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
  return {
    handle: {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', list);
        setDrag({ list, from: { at, index }, over: null });
      },
      onDragEnd: () => setDrag(null),
    },
    target: {
      onDragOver: (event: DragEvent) =>
        markOver(event, drag, setDrag, list, spot(event)),
      onDrop: (event: DragEvent) => {
        if (drag?.list !== list) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setDrag(null);
        onMove(drag.from, spot(event));
      },
    },
    mark: dropMark(drag, list, at, index),
  };
}
