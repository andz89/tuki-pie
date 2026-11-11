import { globalShortcut } from 'electron';
import { checkKeys } from '../../shared/open-keys';
import { UserError } from '../services/user-error';

let current = '';
let onPress: () => void = () => undefined;

export function onOpenKeysPressed(action: () => void): void {
  onPress = action;
}

function register(keys: string): boolean {
  return keys === '' || globalShortcut.register(keys, () => onPress());
}

// Swaps in new keys. They are registered before anything is saved, so keys
// another app already holds are refused and the old ones keep working.
export function setOpenKeys(keys: string): void {
  const checked = checkKeys(keys);
  if (!checked.ok) {
    throw new UserError(checked.error);
  }
  if (keys === current) {
    return;
  }

  const previous = current;
  if (previous !== '') {
    globalShortcut.unregister(previous);
  }
  if (register(keys)) {
    current = keys;
    return;
  }

  register(previous);
  current = previous;
  throw new UserError(
    'Those keys are already used by another app. Try others.',
  );
}

// For tests: forget which keys are registered.
export function resetOpenKeys(): void {
  current = '';
  onPress = () => undefined;
}
