import type { PieIconName } from './icons/SliceIcon';

const MAX_LABEL_LENGTH = 11;

interface RingItem {
  label: string;
  description: string;
  icon: PieIconName;
}

// Clockwise from the top.
export const RING_ITEMS: RingItem[] = [
  { label: 'Screenshot', description: 'Screen or section', icon: 'screenshot' },
  { label: 'Snippets', description: 'Saved text', icon: 'snippet' },
  { label: 'Shortcuts', description: 'Saved links', icon: 'shortcut' },
  { label: 'Apps', description: 'Your programs', icon: 'app' },
  { label: 'Web Page', description: 'Check a website', icon: 'page-info' },
  { label: 'Notes', description: 'Notes and reminders', icon: 'note' },
  { label: 'Zip', description: 'Selected images', icon: 'zip' },
  { label: 'Settings', description: 'Pie Launcher', icon: 'settings' },
];

export const SCREENSHOT_INDEX = 0;
export const SNIPPETS_INDEX = 1;
export const SHORTCUTS_INDEX = 2;
export const APPS_INDEX = 3;
export const PAGE_INFO_INDEX = 4;
export const NOTES_INDEX = 5;
export const ZIP_INDEX = 6;
export const SETTINGS_INDEX = 7;

// What the middle says about the Zip slice. null: still asking Explorer.
export function zipDescription(count: number | null): string {
  if (count === null) {
    return 'Looking for images…';
  }
  if (count === 0) {
    return 'Select images in Explorer first';
  }
  return `${count} ${count === 1 ? 'image' : 'images'} into a zip`;
}

// Slices are narrow, so long names are shortened. The center shows the full name.
export function shortLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) {
    return label;
  }
  return `${label.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
}
