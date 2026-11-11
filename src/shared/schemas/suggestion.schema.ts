import { z } from 'zod';

export const MAX_SUGGESTION_GROUPS = 50;
export const MAX_SUGGESTION_VALUES = 200;
export const MAX_GROUP_NAME_LENGTH = 40;
export const MAX_SUGGESTION_LENGTH = 200;
export const MAX_SUGGESTION_LABEL_LENGTH = 40;

const Id = z.string().min(1).max(64);
// Blank is allowed in changes: the service keeps the old text, or skips it.
const Name = z.string().max(MAX_GROUP_NAME_LENGTH);
const Value = z.string().min(1).max(MAX_SUGGESTION_LENGTH);
const Label = z.string().max(MAX_SUGGESTION_LABEL_LENGTH);
// A full group's worth of values, with commas and spaces between them.
const ValueList = z
  .string()
  .max(MAX_SUGGESTION_VALUES * (MAX_SUGGESTION_LENGTH + 2));

export const SuggestionValue = z.object({
  value: Value,
  label: Label.nullable(),
  hidden: z.boolean(),
});

export const SuggestionGroup = z.object({
  id: Id,
  name: z.string().min(1).max(MAX_GROUP_NAME_LENGTH),
  collapsed: z.boolean(),
  values: SuggestionValue.array(),
});

export const SuggestionChange = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add-group'), name: Name }),
  z.object({ kind: z.literal('rename-group'), id: Id, name: Name }),
  z.object({ kind: z.literal('remove-group'), id: Id }),
  z.object({
    kind: z.literal('reorder-groups'),
    ids: Id.array().max(MAX_SUGGESTION_GROUPS),
  }),
  z.object({
    kind: z.literal('collapse-group'),
    id: Id,
    collapsed: z.boolean(),
  }),
  z.object({ kind: z.literal('hide-group'), id: Id, hidden: z.boolean() }),
  z.object({ kind: z.literal('add-values'), groupId: Id, text: ValueList }),
  z.object({
    kind: z.literal('edit-value'),
    groupId: Id,
    value: Value,
    newValue: z.string().max(MAX_SUGGESTION_LENGTH),
    label: Label,
    toGroupId: Id,
  }),
  // Dragging: lands before the value now at `index` in the target group.
  z.object({
    kind: z.literal('move-value'),
    groupId: Id,
    value: Value,
    toGroupId: Id,
    index: z.number().int().min(0).max(MAX_SUGGESTION_VALUES),
  }),
  z.object({
    kind: z.literal('hide-value'),
    groupId: Id,
    value: Value,
    hidden: z.boolean(),
  }),
  z.object({
    kind: z.literal('reorder-values'),
    groupId: Id,
    values: Value.array().max(MAX_SUGGESTION_VALUES),
  }),
  z.object({ kind: z.literal('remove-value'), groupId: Id, value: Value }),
]);

export type SuggestionValue = z.infer<typeof SuggestionValue>;
export type SuggestionGroup = z.infer<typeof SuggestionGroup>;
export type SuggestionChange = z.infer<typeof SuggestionChange>;

// The only shape the Chrome extension ever receives: visible values only.
export interface ChromeSuggestions {
  enabled: boolean;
  groups: { name: string; values: { value: string; label?: string }[] }[];
}
