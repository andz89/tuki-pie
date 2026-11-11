// The suggestions Pie Launcher sends, kept for suggest.js, the dropdown on
// pages. Only visible values arrive. Saved as `pieSuggestions`:
//   { enabled, groups: [{ name, values: [{ value, label? }] }] }
// Pie Launcher checks these limits too; this side checks again so nothing
// malformed ever reaches a page.

export const SUGGESTIONS_KEY = 'pieSuggestions';

const MAX_GROUPS = 50;
const MAX_VALUES = 200;
const MAX_NAME = 40;
const MAX_VALUE = 200;
const MAX_LABEL = 40;

const isText = (value, max, min = 1) =>
  typeof value === 'string' && value.length >= min && value.length <= max;

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValue = (item) =>
  isRecord(item) &&
  isText(item.value, MAX_VALUE) &&
  (item.label === undefined || isText(item.label, MAX_LABEL, 0));

const isGroup = (group) =>
  isRecord(group) &&
  isText(group.name, MAX_NAME) &&
  Array.isArray(group.values) &&
  group.values.length <= MAX_VALUES &&
  group.values.every(isValue);

export function isSuggestionList(list) {
  return (
    isRecord(list) &&
    typeof list.enabled === 'boolean' &&
    Array.isArray(list.groups) &&
    list.groups.length <= MAX_GROUPS &&
    list.groups.every(isGroup)
  );
}

// Copies only the known fields.
const tidy = ({ enabled, groups }) => ({
  enabled,
  groups: groups.map(({ name, values }) => ({
    name,
    values: values.map(({ value, label }) =>
      label ? { value, label } : { value },
    ),
  })),
});

export function createSuggestionStore(storage) {
  return {
    // Throws on a bad list, so Pie Launcher's request fails and the old
    // list stays.
    async save(list) {
      if (!isSuggestionList(list)) {
        throw new Error('bad-suggestions');
      }
      await storage.set({ [SUGGESTIONS_KEY]: tidy(list) });
    },
  };
}
