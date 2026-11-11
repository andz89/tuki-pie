import { beforeEach, describe, expect, it } from 'vitest';
import { createCtrlShiftClickDetector } from './ctrl-shift-click';

const RIGHT_BUTTON = 2;

function mouse(overrides = {}) {
  return {
    button: 1,
    x: 100,
    y: 100,
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    ...overrides,
  };
}

let donutIsOpen: boolean;
let actions: string[];
let detector: ReturnType<typeof createCtrlShiftClickDetector>;

function click(overrides = {}) {
  detector.mouseDown(mouse(overrides));
  detector.mouseUp(mouse(overrides));
}

beforeEach(() => {
  donutIsOpen = false;
  actions = [];
  detector = createCtrlShiftClickDetector({
    isOpen: () => donutIsOpen,
    open: () => actions.push('open'),
    close: () => actions.push('close'),
  });
});

describe('Ctrl + Shift + click detector', () => {
  it('opens the donut on Ctrl + Shift + left click', () => {
    click();
    expect(actions).toEqual(['open']);
  });

  it('waits for the button to be released before opening', () => {
    detector.mouseDown(mouse());
    expect(actions).toEqual([]);
  });

  it('closes the donut when it is already open', () => {
    donutIsOpen = true;
    click();
    expect(actions).toEqual(['close']);
  });

  it('still closes if the donut hid itself between press and release', () => {
    donutIsOpen = true;
    detector.mouseDown(mouse());
    donutIsOpen = false;
    detector.mouseUp(mouse());
    expect(actions).toEqual(['close']);
  });

  it('ignores a click without Ctrl', () => {
    click({ ctrlKey: false });
    expect(actions).toEqual([]);
  });

  it('ignores a click without Shift', () => {
    click({ shiftKey: false });
    expect(actions).toEqual([]);
  });

  it('ignores Ctrl + Shift + right click', () => {
    click({ button: RIGHT_BUTTON });
    expect(actions).toEqual([]);
  });

  it.each([['altKey'], ['metaKey']])(
    'leaves Ctrl + Shift + %s + click to other apps',
    (modifier) => {
      click({ [modifier]: true });
      expect(actions).toEqual([]);
    },
  );

  it('ignores Ctrl + Shift + drag', () => {
    detector.mouseDown(mouse());
    detector.mouseUp(mouse({ x: 140, y: 100 }));
    expect(actions).toEqual([]);
  });

  it('allows a small hand wobble during the click', () => {
    detector.mouseDown(mouse());
    detector.mouseUp(mouse({ x: 103, y: 102 }));
    expect(actions).toEqual(['open']);
  });

  it('still opens if the keys are let go just before the button', () => {
    detector.mouseDown(mouse());
    detector.mouseUp(mouse({ ctrlKey: false, shiftKey: false }));
    expect(actions).toEqual(['open']);
  });

  it('ignores a release with no matching press', () => {
    detector.mouseUp(mouse());
    expect(actions).toEqual([]);
  });

  it('ignores another button being released mid-click', () => {
    detector.mouseDown(mouse());
    detector.mouseUp(mouse({ button: RIGHT_BUTTON }));
    expect(actions).toEqual([]);
    detector.mouseUp(mouse());
    expect(actions).toEqual(['open']);
  });

  it('counts each click once', () => {
    click();
    detector.mouseUp(mouse());
    expect(actions).toEqual(['open']);
  });

  it('forgets a Ctrl + Shift press when a plain press follows', () => {
    const plain = { ctrlKey: false, shiftKey: false };
    detector.mouseDown(mouse());
    detector.mouseDown(mouse(plain));
    detector.mouseUp(mouse(plain));
    expect(actions).toEqual([]);
  });
});
