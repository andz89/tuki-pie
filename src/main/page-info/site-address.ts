import {
  isWebLink,
  normalizeWebAddress,
} from '../../shared/schemas/shortcut.schema';

export const isSiteUrl = isWebLink;

export function enteredAddress(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const address = normalizeWebAddress(value);
  return isSiteUrl(address) ? address : null;
}

// Stricter than typing an address: only one whole address counts, so ordinary
// copied text never makes the app visit anything.
export function addressFromClipboard(text: string): string | null {
  const address = text.trim();
  return /\s/.test(address) || !isSiteUrl(address) ? null : address;
}
