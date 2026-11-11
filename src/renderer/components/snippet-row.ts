const PREVIEW_LENGTH = 30;

// Array.from keeps an emoji in one piece at the cut.
export function snippetPreview(content: string): string {
  const characters = Array.from(content.replace(/\s+/g, ' ').trim());
  return characters.length > PREVIEW_LENGTH
    ? `${characters.slice(0, PREVIEW_LENGTH).join('')}…`
    : characters.join('');
}
