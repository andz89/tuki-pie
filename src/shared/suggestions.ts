import type { ChromeSuggestions, SuggestionGroup } from './types';

// Suggestions are one line: line breaks and tabs become spaces.
export const cleanText = (text: string): string =>
  text.replace(/[\r\n\t]+/g, ' ').trim();

// "13, 02, 00" is three values. Blanks and repeats are dropped.
export const splitValues = (text: string): string[] => [
  ...new Set(text.split(',').map(cleanText).filter(Boolean)),
];

export function toChromeSuggestions(
  groups: SuggestionGroup[],
  enabled: boolean,
): ChromeSuggestions {
  return {
    enabled,
    groups: groups
      .map(({ name, values }) => ({
        name,
        values: values
          .filter(({ hidden }) => !hidden)
          .map(({ value, label }) => (label ? { value, label } : { value })),
      }))
      .filter(({ values }) => values.length > 0),
  };
}

// Moves the item at `from` so it lands before the item now at `to`
// (`to` = length puts it last). A new list; a bad `from` returns it unchanged.
export function moveItem<Item>(list: Item[], from: number, to: number): Item[] {
  if (from < 0 || from >= list.length) {
    return list;
  }
  const items = [...list];
  const [moved] = items.splice(from, 1);
  items.splice(from < to ? to - 1 : to, 0, moved);
  return items;
}
