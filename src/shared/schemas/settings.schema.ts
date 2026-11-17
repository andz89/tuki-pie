import { z } from 'zod';
import { DEFAULT_LINK_FILTER } from '../link-rules';
import {
  INFO_CARD_FIELDS,
  InfoCardFields,
  InfoCardLayout,
  LinksOpenIn,
} from './info-card.schema';

export const Theme = z.enum(['dark', 'light']);

export const PieSize = z.enum(['small', 'medium', 'large']);

// A word rather than true/false, because the settings table only stores text.
export const Pin = z.enum(['unpinned', 'pinned']);

// Whether Page Info stays above other windows.
export const OnTop = z.enum(['normal', 'on-top']);

// Whether the Pie extension shows saved suggestions under fields in Chrome.
export const OnOff = z.enum(['on', 'off']);

export const Settings = z.object({
  theme: Theme,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: PieSize,
  pin: Pin,
  pageInfoOnTop: OnTop,
  // Keys that open the donut from anywhere, like "Ctrl+Alt+Space". Empty is off.
  openKeys: z.string().max(60),
  // Page Info's Link filters, as JSON. See shared/link-rules.ts.
  linkFilter: z.string().max(20000),
  suggestionsInChrome: OnOff,
  // The Info Card's place on screen and the page info it shows.
  infoCardLayout: InfoCardLayout,
  infoCardFields: InfoCardFields,
  // Where the Links card opens links.
  linksOpenIn: LinksOpenIn,
});

export const SettingsUpdate = Settings.partial();

// What the donut may change from its Settings circles.
export const PieLookUpdate = Settings.pick({
  theme: true,
  accent: true,
  size: true,
  pin: true,
})
  .partial()
  .strict();

export type Theme = z.infer<typeof Theme>;
export type PieSize = z.infer<typeof PieSize>;
export type Pin = z.infer<typeof Pin>;
export type OnTop = z.infer<typeof OnTop>;
export type OnOff = z.infer<typeof OnOff>;
export type Settings = z.infer<typeof Settings>;
export type SettingsUpdate = z.infer<typeof SettingsUpdate>;
export type PieLookUpdate = z.infer<typeof PieLookUpdate>;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: '#2563EB',
  size: 'medium',
  pin: 'unpinned',
  pageInfoOnTop: 'normal',
  openKeys: 'Ctrl+Alt+Space',
  linkFilter: JSON.stringify(DEFAULT_LINK_FILTER),
  suggestionsInChrome: 'on',
  infoCardLayout: 'sidebar',
  infoCardFields: INFO_CARD_FIELDS.join(','),
  linksOpenIn: 'chrome',
};

export const PIE_SCALES: Record<PieSize, number> = {
  small: 0.8,
  medium: 1,
  large: 1.25,
};

export const ACCENT_PRESETS = [
  { value: '#2563EB', label: 'Blue' },
  { value: '#0F766E', label: 'Teal' },
  { value: '#C2410C', label: 'Orange' },
  { value: '#7C3AED', label: 'Purple' },
];
