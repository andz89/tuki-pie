// How far the pointer must travel before a press counts as a drag.
const DRAG_THRESHOLD = 4;

export function createDragTracker(
  moveBy: (deltaX: number, deltaY: number) => void,
) {
  let anchor: { x: number; y: number } | null = null;
  let isDragging = false;

  return {
    press(x: number, y: number): void {
      anchor = { x, y };
      isDragging = false;
    },

    // Returns true for the one move that turns the press into a drag.
    move(x: number, y: number): boolean {
      if (!anchor) {
        return false;
      }

      const startsDrag =
        !isDragging && Math.hypot(x - anchor.x, y - anchor.y) >= DRAG_THRESHOLD;
      if (!isDragging && !startsDrag) {
        return false;
      }
      isDragging = true;

      // The window moves in whole pixels, so any remainder carries forward.
      const deltaX = Math.round(x - anchor.x);
      const deltaY = Math.round(y - anchor.y);
      if (deltaX !== 0 || deltaY !== 0) {
        anchor = { x: anchor.x + deltaX, y: anchor.y + deltaY };
        moveBy(deltaX, deltaY);
      }
      return startsDrag;
    },

    // Returns true if the press turned into a drag.
    release(): boolean {
      const wasDrag = isDragging;
      anchor = null;
      isDragging = false;
      return wasDrag;
    },
  };
}
