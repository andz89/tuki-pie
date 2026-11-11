import type { Shortcut } from '../../shared/types';

// The drop area under the list, for taking a shortcut out of its group.
export const TOP_ROW_END = 'top-row-end';

export interface DropSpot {
  parentId: string | null;
  // Counts the row without the dragged shortcut, as the move expects.
  index: number;
  // Where to draw the hint: into a group, or a line above or below a row.
  markId: string;
  mark: 'inside' | 'before' | 'after';
}

// Where a dragged shortcut lands when dropped on another row, or null when
// that changes nothing. A link or app dropped on a group goes inside it, at
// the end. Dropped on any other row, it takes that row's place. A group only
// ever moves along the top row.
export function dropSpot(
  shortcuts: Shortcut[],
  draggedId: string,
  overId: string,
): DropSpot | null {
  const dragged = shortcuts.find((item) => item.id === draggedId);
  if (!dragged || overId === draggedId) {
    return null;
  }
  const rowOf = (parentId: string | null) =>
    shortcuts.filter((item) => item.parentId === parentId);
  const rowWithout = (parentId: string | null) =>
    rowOf(parentId).filter((item) => item.id !== draggedId);

  let spot: DropSpot;
  if (overId === TOP_ROW_END) {
    spot = {
      parentId: null,
      index: rowWithout(null).length,
      markId: TOP_ROW_END,
      mark: 'inside',
    };
  } else {
    const over = shortcuts.find((item) => item.id === overId);
    if (!over) {
      return null;
    }
    // A group dropped among a group's shortcuts means beside that group.
    const target =
      dragged.type === 'group' && over.parentId !== null
        ? shortcuts.find((item) => item.id === over.parentId)
        : over;
    if (!target || target.id === draggedId) {
      return null;
    }
    if (target.type === 'group' && dragged.type !== 'group') {
      spot = {
        parentId: target.id,
        index: rowWithout(target.id).length,
        markId: target.id,
        mark: 'inside',
      };
    } else {
      const row = rowOf(target.parentId);
      const index = row.findIndex((item) => item.id === target.id);
      const draggedIndex = row.findIndex((item) => item.id === draggedId);
      // Moving down its own row, it lands just after the row it was dropped on.
      const isAfter = draggedIndex !== -1 && draggedIndex < index;
      spot = {
        parentId: target.parentId,
        index,
        markId: target.id,
        mark: isAfter ? 'after' : 'before',
      };
    }
  }

  const currentIndex = rowOf(dragged.parentId).findIndex(
    (item) => item.id === draggedId,
  );
  const isSamePlace =
    spot.parentId === dragged.parentId && spot.index === currentIndex;
  return isSamePlace ? null : spot;
}
