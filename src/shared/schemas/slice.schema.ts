import { z } from 'zod';

export const MIN_SLICES = 2;
export const MAX_SLICES = 8;

export const SliceType = z.enum(['app', 'folder', 'note']);

export const Slice = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(24),
  type: SliceType,
  path: z.string().min(1),
  position: z.number().int().min(0).max(7),
});

// Longest path Windows tools handle without special prefixes.
const MAX_PATH_LENGTH = 2048;

// "C:\..." or "C:/...", or a network share "\\server\share".
const FULL_WINDOWS_PATH = /^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/])/;

// What a new or changed slice may point at. Stored slices keep the looser
// rule above, so one saved by an older version still loads.
const SlicePath = z
  .string()
  .min(1)
  .max(MAX_PATH_LENGTH)
  .regex(FULL_WINDOWS_PATH);

export const NewSlice = Slice.omit({ id: true, position: true }).extend({
  path: SlicePath,
});

export const SliceEdit = Slice.omit({ position: true }).extend({
  path: SlicePath,
});

export type SliceType = z.infer<typeof SliceType>;
export type Slice = z.infer<typeof Slice>;
export type NewSlice = z.infer<typeof NewSlice>;
export type SliceEdit = z.infer<typeof SliceEdit>;
