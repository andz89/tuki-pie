import { z } from 'zod';

export const MAX_SNIPPETS = 8;
export const MAX_SNIPPET_LENGTH = 10000;

const isNotBlank = (value: string) => value.trim() !== '';

const Id = z.string().min(1).max(64);
const Label = z.string().min(1).max(24).refine(isNotBlank);
// Never trimmed: the text must reach the clipboard exactly as it was saved.
const Content = z.string().min(1).max(MAX_SNIPPET_LENGTH).refine(isNotBlank);

export const Snippet = z.object({
  id: Id,
  label: Label,
  content: Content,
  position: z.number().int().min(0),
});

export const NewSnippet = z.object({ label: Label, content: Content });

export const SnippetEdit = z.object({
  id: Id,
  label: Label,
  content: Content,
});

export type Snippet = z.infer<typeof Snippet>;
export type NewSnippet = z.infer<typeof NewSnippet>;
export type SnippetEdit = z.infer<typeof SnippetEdit>;
