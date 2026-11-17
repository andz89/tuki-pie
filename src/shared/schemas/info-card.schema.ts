import { z } from 'zod';

// Where the Info Card sits on the screen.
export const InfoCardLayout = z.enum(['sidebar', 'top', 'bottom']);

// What the card window shows: the Info Card, or the Links or Images card in
// its place.
export const InfoCardView = z.enum(['info', 'links', 'images']);
export type InfoCardView = z.infer<typeof InfoCardView>;

// Where the Links card opens links: background tabs in Chrome, or each in
// its own Web Page tab.
export const LinksOpenIn = z.enum(['chrome', 'web-page']);
export type LinksOpenIn = z.infer<typeof LinksOpenIn>;

// The groups of page info the card can show, in the order it shows them.
export const INFO_CARD_FIELDS = [
  'title',
  'canonical',
  'headings',
  'counts',
  'tracking',
  'hyvor',
  'images',
] as const;
export const InfoCardField = z.enum(INFO_CARD_FIELDS);

// The settings table stores text, so the ticked groups are kept as
// "title,counts". Empty means none. A value from an older build that names
// a group no longer here falls back to the default (every group).
export const InfoCardFields = z
  .string()
  .max(200)
  .refine((value) =>
    value === ''
      ? true
      : value
          .split(',')
          .every((field) => InfoCardField.safeParse(field).success),
  );

export type InfoCardLayout = z.infer<typeof InfoCardLayout>;
export type InfoCardField = z.infer<typeof InfoCardField>;

export function fieldsFromSetting(value: string): InfoCardField[] {
  const ticked = new Set(value.split(','));
  return INFO_CARD_FIELDS.filter((field) => ticked.has(field));
}

export function fieldsToSetting(fields: readonly InfoCardField[]): string {
  return INFO_CARD_FIELDS.filter((field) => fields.includes(field)).join(',');
}
