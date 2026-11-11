// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import SCRIPT from './suggest.js?raw';

interface List {
  enabled: boolean;
  groups: { name: string; values: { value: string; label?: string }[] }[];
}

interface Started {
  stop: () => void;
  box: HTMLElement;
}

type Start = (options: {
  storage: { get: (key: string) => Promise<Record<string, unknown>> };
  onChanged: {
    addListener: (listener: (changes: object, area: string) => void) => void;
    removeListener: (listener: unknown) => void;
  };
  isTrusted?: (event: Event) => boolean;
  shadowMode?: 'open' | 'closed';
  now?: () => number;
  elementAt?: (x: number, y: number) => Element | null;
}) => Started;

const LIST: List = {
  enabled: true,
  groups: [
    {
      name: 'Day',
      values: [{ value: '01' }, { value: '13', label: 'Friday' }],
    },
    { name: 'Month', values: [{ value: '06', label: 'June' }] },
  ],
};

let current: Started | null = null;
// The time the list sees, moved on by hand.
let clock = 0;
// What the page shows under the pointer; the list's host unless a test says.
let elementAt: ((x: number, y: number) => Element | null) | null = null;

const hostOf = (box: HTMLElement) =>
  (box.getRootNode() as ShadowRoot).host as Element;
let changeListeners: ((changes: object, area: string) => void)[] = [];

async function load(
  html: string,
  list: List | null = LIST,
  trusted = true,
): Promise<Started> {
  document.body.innerHTML = html;
  const hook: { start?: Start } = {};
  (globalThis as Record<string, unknown>).__pieSuggestTest = hook;
  new Function(SCRIPT)();
  delete (globalThis as Record<string, unknown>).__pieSuggestTest;
  changeListeners = [];
  current = hook.start!({
    storage: {
      get: async () => (list === null ? {} : { pieSuggestions: list }),
    },
    onChanged: {
      addListener: (listener) => changeListeners.push(listener),
      removeListener: () => undefined,
    },
    isTrusted: trusted ? () => true : undefined,
    shadowMode: 'open',
    now: () => clock,
    elementAt: (x, y) => (elementAt ? elementAt(x, y) : hostOf(current!.box)),
  });
  await new Promise((done) => setTimeout(done));
  return current;
}

function sendList(list: List): void {
  for (const listener of changeListeners) {
    listener({ pieSuggestions: { newValue: list } }, 'local');
  }
}

const field = <T extends Element = HTMLInputElement>(id: string) =>
  document.getElementById(id) as unknown as T;

function click(el: Element, shiftKey = false): MouseEvent {
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey }),
  );
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    shiftKey,
  });
  el.dispatchEvent(event);
  return event;
}

const isOpen = (box: HTMLElement) => box.style.display !== 'none';
const parts = (box: HTMLElement, kind: string) => [
  ...box.querySelectorAll<HTMLElement>(`[data-kind="${kind}"]`),
];
const itemTexts = (box: HTMLElement) =>
  parts(box, 'item').map((item) => item.dataset.value);

// A press on a part of the list, once the person has had time to see it.
function press(part: HTMLElement, waitMs = 1000): void {
  clock += waitMs;
  part.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 5,
      clientY: 5,
    }),
  );
}

function pick(box: HTMLElement, value: string, waitMs = 1000): void {
  const item = parts(box, 'item').find((each) => each.dataset.value === value);
  if (!item) throw new Error(`No item ${value}`);
  press(item, waitMs);
}

afterEach(() => {
  current?.stop();
  current = null;
  elementAt = null;
});

describe('opening', () => {
  it('ignores a click the page makes itself', async () => {
    const { box } = await load('<input id="a">', LIST, false);
    click(field('a'));
    expect(isOpen(box)).toBe(false);
  });

  it('shows the groups, values and labels under a clicked field', async () => {
    const { box } = await load('<input id="a">');
    click(field('a'));
    expect(isOpen(box)).toBe(true);
    expect(parts(box, 'heading').map((h) => h.textContent)).toEqual([
      'Day',
      'Month',
    ]);
    expect(itemTexts(box)).toEqual(['01', '13', '06']);
    expect(parts(box, 'item')[1].textContent).toBe('13Friday');
  });

  it('opens for text areas too', async () => {
    const { box } = await load('<textarea id="a"></textarea>');
    click(field('a'));
    expect(isOpen(box)).toBe(true);
  });

  it.each([
    ['a checkbox', '<input id="a" type="checkbox">'],
    ['a button', '<input id="a" type="submit">'],
    ['a read-only field', '<input id="a" readonly>'],
    ['a disabled field', '<input id="a" disabled>'],
  ])('stays closed on %s', async (_name, html) => {
    const { box } = await load(html);
    click(field('a'));
    expect(isOpen(box)).toBe(false);
  });

  it('stays closed when switched off', async () => {
    const { box } = await load('<input id="a">', { ...LIST, enabled: false });
    click(field('a'));
    expect(isOpen(box)).toBe(false);
  });

  it('stays closed with no list saved yet', async () => {
    const { box } = await load('<input id="a">', null);
    click(field('a'));
    expect(isOpen(box)).toBe(false);
  });

  it('opens when the person tabs into a field, not when the page focuses it', async () => {
    const { box } = await load('<input id="a"><input id="b">');
    field('b').focus();
    expect(isOpen(box)).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    field('a').focus();
    expect(isOpen(box)).toBe(true);
  });

  it('closes on Esc', async () => {
    const { box } = await load('<input id="a">');
    click(field('a'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isOpen(box)).toBe(false);
  });

  it('closes on a click somewhere else', async () => {
    const { box } = await load('<input id="a"><p id="p">x</p>');
    click(field('a'));
    click(field('p'));
    expect(isOpen(box)).toBe(false);
  });

  it('keeps the list out of the page', async () => {
    await load('<input id="a">');
    click(field('a'));
    expect(document.body.innerHTML).not.toContain('Friday');
  });
});

describe('filling one field', () => {
  it('fills the value the way typing would, and closes', async () => {
    const { box } = await load('<input id="a">');
    const input = field('a');
    const seen: string[] = [];
    input.addEventListener('input', () => seen.push('input'));
    input.addEventListener('change', () => seen.push('change'));
    click(input);
    pick(box, '13');
    expect(input.value).toBe('13');
    expect(seen).toEqual(['input', 'change']);
    expect(isOpen(box)).toBe(false);
  });

  it('marks the value already in the field', async () => {
    const { box } = await load('<input id="a" value="13">');
    click(field('a'));
    const marked = parts(box, 'item').filter(
      (item) => item.getAttribute('aria-selected') === 'true',
    );
    expect(marked.map((item) => item.dataset.value)).toEqual(['13']);
  });
});

describe('select boxes', () => {
  const SELECT =
    '<select id="s"><option value="">-</option><option value="6">06-Jun</option><option value="1">01-Jan</option></select>';

  it('offers only values that match an option, by the start of its text', async () => {
    const { box } = await load(SELECT);
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    field('s').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(itemTexts(box)).toEqual(['1', '6']);
    expect(
      parts(box, 'item').map((item) => item.firstChild?.textContent),
    ).toEqual(['01-Jan', '06-Jun']);
    expect(parts(box, 'show-all')).toHaveLength(1);
    pick(box, '6');
    expect(field<HTMLSelectElement>('s').value).toBe('6');
  });

  it('leaves the normal list alone when nothing matches', async () => {
    const { box } = await load(
      '<select id="s"><option>Red</option><option>Blue</option></select>',
    );
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    field('s').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(isOpen(box)).toBe(false);
  });
});

describe('filling several fields', () => {
  const THREE = '<input id="a"><input id="b"><input id="c">';

  it('outlines Shift+clicked fields and fills them all with one value', async () => {
    const { box } = await load(THREE);
    click(field('a'), true);
    click(field('c'), true);
    expect(field('a').style.outline).toContain('solid');
    expect(parts(box, 'hint')).toHaveLength(1);
    pick(box, '01');
    expect([field('a').value, field('b').value, field('c').value]).toEqual([
      '01',
      '',
      '01',
    ]);
    expect(field('a').style.outline).toBe('');
    expect(isOpen(box)).toBe(false);
  });

  it('fills in page order with a group in order', async () => {
    const { box } = await load(THREE);
    click(field('c'), true);
    click(field('b'), true);
    click(field('a'), true);
    const fill = parts(box, 'fill')[0];
    expect(fill.textContent).toBe('Fill in order (2)');
    press(fill);
    expect([field('a').value, field('b').value, field('c').value]).toEqual([
      '01',
      '13',
      '',
    ]);
  });

  it('a second Shift+click takes a field out again', async () => {
    const { box } = await load(THREE);
    click(field('a'), true);
    click(field('a'), true);
    expect(field('a').style.outline).toBe('');
    expect(isOpen(box)).toBe(false);
  });

  it('a normal click clears the selection', async () => {
    await load(THREE);
    click(field('a'), true);
    click(field('b'));
    expect(field('a').style.outline).toBe('');
  });
});

describe('changes from Pie Launcher', () => {
  it('uses a new list right away', async () => {
    const { box } = await load('<input id="a">');
    sendList({
      enabled: true,
      groups: [{ name: 'X', values: [{ value: 'y' }] }],
    });
    click(field('a'));
    expect(itemTexts(box)).toEqual(['y']);
  });

  it('switching off closes the list and clears outlines', async () => {
    const { box } = await load('<input id="a"><input id="b">');
    click(field('a'), true);
    sendList({ ...LIST, enabled: false });
    expect(isOpen(box)).toBe(false);
    expect(field('a').style.outline).toBe('');
  });

  it('ignores a malformed list', async () => {
    const { box } = await load('<input id="a">');
    sendList({ enabled: true, groups: 'x' } as unknown as List);
    click(field('a'));
    expect(itemTexts(box)).toEqual(['01', '13', '06']);
  });
});

describe('stopping', () => {
  it('removes the list and stops listening', async () => {
    const started = await load('<input id="a">');
    const spy = vi.spyOn(document, 'removeEventListener');
    started.stop();
    current = null;
    expect(spy).toHaveBeenCalled();
    click(field('a'));
    expect(started.box.isConnected).toBe(false);
  });
});

describe('fields it never offers values for', () => {
  it.each([
    '<input id="a" type="password">',
    '<input id="a" autocomplete="one-time-code">',
    '<input id="a" autocomplete="cc-number">',
    '<input id="a" autocomplete="billing cc-csc">',
    '<input id="a" autocomplete="current-password">',
  ])('%s', async (html) => {
    const { box } = await load(html);
    click(field('a'));
    expect(isOpen(box)).toBe(false);
  });
});

describe('a pick the person could not have meant', () => {
  it('is ignored right after the list opens', async () => {
    const { box } = await load('<input id="a">');
    click(field('a'));
    pick(box, '13', 100);
    expect(field('a').value).toBe('');
    pick(box, '13', 300);
    expect(field('a').value).toBe('13');
  });

  it('is ignored when something else is under the pointer', async () => {
    const { box } = await load('<input id="a"><div id="cover"></div>');
    elementAt = () => field<HTMLElement>('cover');
    click(field('a'));
    pick(box, '13');
    expect(field('a').value).toBe('');
  });

  it('is ignored when the page made the list see-through', async () => {
    const { box } = await load('<input id="a">');
    click(field('a'));
    hostOf(box).style.opacity = '0';
    pick(box, '13');
    expect(field('a').value).toBe('');
  });

  it('is ignored when the page hid a parent of the list', async () => {
    const { box } = await load('<input id="a">');
    click(field('a'));
    document.body.style.opacity = '0.1';
    pick(box, '13');
    document.body.style.opacity = '';
    expect(field('a').value).toBe('');
  });

  it('keeps its own look over the page styles', async () => {
    const { box } = await load('<input id="a">');
    click(field('a'));
    expect(hostOf(box).style.getPropertyPriority('opacity')).toBe('important');
  });
});
