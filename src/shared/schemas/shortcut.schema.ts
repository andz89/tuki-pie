import { z } from 'zod';

export const MAX_SHORTCUTS_PER_ROW = 8;
// Apps fan out around the whole donut: a full ring holds this many circles.
export const MAX_APPS = 18;

const MAX_TARGET_LENGTH = 2048;

const Id = z.string().min(1).max(64);
const Label = z.string().min(1).max(24);
const ParentId = Id.nullable();
const AppPath = z.string().min(1).max(MAX_TARGET_LENGTH);

export function isWebLink(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === 'https:' || protocol === 'http:') && hostname !== '';
  } catch {
    return false;
  }
}

// A colon followed by a number is a port, as in localhost:3000, not a scheme.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

export function normalizeWebAddress(value: string): string {
  const address = value.trim();
  return HAS_SCHEME.test(address) ? address : `https://${address}`;
}

const WebLink = z.string().max(MAX_TARGET_LENGTH).refine(isWebLink);

// A path is a folder or file on this computer, kept with the links. Apps
// have their own tab and slice.
export const ShortcutType = z.enum(['link', 'path', 'app', 'group']);

export const Shortcut = z.object({
  id: Id,
  label: Label,
  type: ShortcutType,
  target: z.string().max(MAX_TARGET_LENGTH).nullable(),
  parentId: ParentId,
  position: z.number().int().min(0),
});

export const NewShortcut = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('link'),
    label: Label,
    target: WebLink,
    parentId: ParentId,
  }),
  z.object({
    type: z.literal('path'),
    label: Label,
    target: AppPath,
    parentId: ParentId,
  }),
  z.object({
    type: z.literal('app'),
    label: Label,
    target: AppPath,
    parentId: ParentId,
  }),
  z.object({
    type: z.literal('group'),
    label: Label,
    target: z.null(),
    parentId: z.null(),
  }),
]);

export const ShortcutEdit = z.object({
  id: Id,
  label: Label,
  target: z.string().max(MAX_TARGET_LENGTH).nullable(),
});

// What the donut asks the settings window to show.
export const PanelFormRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shortcut'), parentId: ParentId }),
  z.object({ kind: z.literal('group') }),
  z.object({ kind: z.literal('section') }),
  z.object({ kind: z.literal('snippet-new') }),
  z.object({ kind: z.literal('snippet-edit'), id: Id }),
  z.object({ kind: z.literal('snippets-section') }),
  z.object({ kind: z.literal('app-new') }),
  z.object({ kind: z.literal('apps-section') }),
]);

export type ShortcutType = z.infer<typeof ShortcutType>;
export type Shortcut = z.infer<typeof Shortcut>;
export type NewShortcut = z.infer<typeof NewShortcut>;
export type ShortcutEdit = z.infer<typeof ShortcutEdit>;
export type PanelFormRequest = z.infer<typeof PanelFormRequest>;
