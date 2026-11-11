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

export const NewSlice = Slice.omit({ id: true, position: true });

export const SliceEdit = Slice.omit({ position: true });

export type SliceType = z.infer<typeof SliceType>;
export type Slice = z.infer<typeof Slice>;
export type NewSlice = z.infer<typeof NewSlice>;
export type SliceEdit = z.infer<typeof SliceEdit>;
