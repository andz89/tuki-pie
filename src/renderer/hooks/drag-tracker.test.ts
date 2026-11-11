import { beforeEach, describe, expect, it } from 'vitest';
import { createDragTracker } from './drag-tracker';

let moves: Array<[number, number]>;
let tracker: ReturnType<typeof createDragTracker>;

beforeEach(() => {
  moves = [];
  tracker = createDragTracker((deltaX, deltaY) => {
    moves.push([deltaX, deltaY]);
  });
});

describe('drag tracker', () => {
  it('treats a press and release in place as a click', () => {
    tracker.press(100, 100);
    expect(tracker.release()).toBe(false);
    expect(moves).toEqual([]);
  });

  it('treats a small wobble as a click, so slices stay easy to click', () => {
    tracker.press(100, 100);
    tracker.move(102, 101);
    expect(tracker.release()).toBe(false);
    expect(moves).toEqual([]);
  });

  it('moves the window the full distance once the press becomes a drag', () => {
    tracker.press(100, 100);
    tracker.move(110, 96);
    expect(moves).toEqual([[10, -4]]);
  });

  it('reports the move that begins the drag, and only that one', () => {
    tracker.press(100, 100);
    expect(tracker.move(102, 100)).toBe(false);
    expect(tracker.move(110, 100)).toBe(true);
    expect(tracker.move(120, 100)).toBe(false);
  });

  it('sends only the change on later moves', () => {
    tracker.press(100, 100);
    tracker.move(110, 100);
    tracker.move(115, 103);
    expect(moves).toEqual([
      [10, 0],
      [5, 3],
    ]);
  });

  it('keeps following small moves once dragging', () => {
    tracker.press(100, 100);
    tracker.move(110, 100);
    tracker.move(111, 100);
    expect(moves).toEqual([
      [10, 0],
      [1, 0],
    ]);
  });

  it('does not lose fractions of a pixel on scaled displays', () => {
    tracker.press(100, 100);
    tracker.move(110.4, 100);
    tracker.move(110.8, 100);
    expect(moves).toEqual([
      [10, 0],
      [1, 0],
    ]);
  });

  it('does not send a move when nothing changed', () => {
    tracker.press(100, 100);
    tracker.move(110, 100);
    tracker.move(110, 100);
    expect(moves).toEqual([[10, 0]]);
  });

  it('reports a drag on release', () => {
    tracker.press(100, 100);
    tracker.move(110, 100);
    expect(tracker.release()).toBe(true);
  });

  it('ignores movement when nothing is pressed', () => {
    tracker.move(110, 100);
    expect(moves).toEqual([]);
  });

  it('stops following after release', () => {
    tracker.press(100, 100);
    tracker.move(110, 100);
    tracker.release();
    tracker.move(150, 100);
    expect(moves).toEqual([[10, 0]]);
  });

  it('starts fresh on the next press', () => {
    tracker.press(100, 100);
    tracker.move(110, 100);
    tracker.release();
    tracker.press(200, 200);
    expect(tracker.release()).toBe(false);
  });
});
