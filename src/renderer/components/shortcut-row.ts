import type { Shortcut } from '../../shared/types';

export interface ShortcutBranch {
  shortcut: Shortcut;
  children: Shortcut[];
}

// The top level in order, each group holding what is inside it.
export function shortcutTree(all: Shortcut[]): ShortcutBranch[] {
  return all
    .filter((shortcut) => shortcut.parentId === null)
    .map((shortcut) => ({
      shortcut,
      children:
        shortcut.type === 'group'
          ? all.filter((child) => child.parentId === shortcut.id)
          : [],
    }));
}

// The small grey line under a shortcut's name.
export function shortcutDetail(shortcut: Shortcut): string {
  const target = shortcut.target?.trim();
  if (!target) {
    return 'No link';
  }
  if (shortcut.type === 'link') {
    try {
      return new URL(target).hostname.replace(/^www\./, '');
    } catch {
      return target;
    }
  }
  const [name = target] = target.split(/[\\/]/).filter(Boolean).slice(-1);
  return name;
}

// Array.from keeps an emoji in one piece, where indexing would split it.
export function firstLetter(label: string): string {
  const [first = ''] = Array.from(label.trim());
  return first.toLocaleUpperCase();
}
