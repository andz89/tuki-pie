const MAX_LABEL_LENGTH = 24;

// Suggests a name for a slice from the last part of its location.
export function labelFromPath(path: string): string {
  const lastPart =
    path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? '';
  const withoutExtension = lastPart.replace(/\.[^.]+$/, '');
  return (withoutExtension || lastPart).slice(0, MAX_LABEL_LENGTH);
}
