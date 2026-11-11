// The keys that open the donut, stored as an Electron accelerator such as
// "Ctrl+Alt+Space". An empty string means the keys are turned off.

export interface KeyPress {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type KeysResult =
  | { ok: true; keys: string }
  | { ok: false; error: string };

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Super'] as const;

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
};

const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

// The app presses F24 itself to take focus, so it can't be one of the keys.
const RESERVED_KEY = 'F24';

const NO_MODIFIER =
  'Add Ctrl, Alt or Win, so the keys don’t get in the way of typing.';

// Uses the physical key, so the same keys work whatever the keyboard layout.
function keyName(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) {
    return letter[1];
  }
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) {
    return digit[1];
  }
  const numpad = /^Numpad([0-9])$/.exec(code);
  if (numpad) {
    return `num${numpad[1]}`;
  }
  if (FUNCTION_KEY.test(code)) {
    return code;
  }
  return NAMED_KEYS[code] ?? null;
}

function isAllowedKey(key: string): boolean {
  return (
    Object.values(NAMED_KEYS).includes(key) ||
    /^[A-Z0-9]$/.test(key) ||
    /^num[0-9]$/.test(key) ||
    FUNCTION_KEY.test(key)
  );
}

function checkParts(modifiers: string[], key: string): KeysResult {
  if (key === RESERVED_KEY) {
    return { ok: false, error: 'F24 is used by Pie Launcher itself.' };
  }
  const hasStrongModifier = modifiers.some((name) => name !== 'Shift');
  if (!hasStrongModifier && !FUNCTION_KEY.test(key)) {
    return { ok: false, error: NO_MODIFIER };
  }
  return { ok: true, keys: [...modifiers, key].join('+') };
}

// Null while only modifiers are held: the person hasn't finished pressing.
export function keysFromPress(press: KeyPress): KeysResult | null {
  const key = keyName(press.code);
  if (!key) {
    return /^(Control|Shift|Alt|Meta|OS)/.test(press.code)
      ? null
      : { ok: false, error: 'That key can’t be used. Try another.' };
  }
  const modifiers = MODIFIERS.filter(
    (name) =>
      ({
        Ctrl: press.ctrlKey,
        Alt: press.altKey,
        Shift: press.shiftKey,
        Super: press.metaKey,
      })[name],
  );
  return checkParts(modifiers, key);
}

// Checks stored or incoming keys. Empty means off and is always fine.
export function checkKeys(keys: string): KeysResult {
  if (keys === '') {
    return { ok: true, keys };
  }
  const parts = keys.split('+');
  const key = parts.pop() ?? '';
  const invalid: KeysResult = {
    ok: false,
    error: 'Those keys can’t be used. Try others.',
  };
  if (!isAllowedKey(key)) {
    return invalid;
  }
  // Modifiers must be known, unique, and in the usual order.
  const modifiers = MODIFIERS.filter((name) => parts.includes(name));
  if (modifiers.length !== parts.length || modifiers.join() !== parts.join()) {
    return invalid;
  }
  return checkParts(modifiers, key);
}

export function formatKeys(keys: string): string {
  if (keys === '') {
    return 'Off';
  }
  return keys
    .split('+')
    .map((part) => (part === 'Super' ? 'Win' : part))
    .join(' + ');
}
