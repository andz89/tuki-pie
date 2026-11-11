import { ACCENT_PRESETS } from '../../shared/schemas/settings.schema';
import type { Pin, PieSize, Theme } from '../../shared/schemas/settings.schema';

const SIZES: PieSize[] = ['small', 'medium', 'large'];

export function nextPin(pin: Pin): Pin {
  return pin === 'pinned' ? 'unpinned' : 'pinned';
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function nextSize(size: PieSize): PieSize {
  return SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
}

function presetIndex(accent: string): number {
  return ACCENT_PRESETS.findIndex(
    ({ value }) => value.toLowerCase() === accent.toLowerCase(),
  );
}

export function nextAccent(accent: string): string {
  // A custom color isn't in the list, so -1 moves on to the first preset.
  return ACCENT_PRESETS[(presetIndex(accent) + 1) % ACCENT_PRESETS.length]
    .value;
}

export function accentName(accent: string): string {
  return ACCENT_PRESETS[presetIndex(accent)]?.label ?? 'Custom';
}
