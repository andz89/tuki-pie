import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { usePieStore } from '../stores/pie.store';
import { PieListCard } from './PieListCard';
import { PieIcon } from './icons/SliceIcon';
import { SNIPPETS_INDEX } from './slice-display';
import { snippetPreview } from './snippet-row';

export function PieSnippetsList() {
  const snippets = usePieStore((state) => state.snippets);
  const loadSnippets = usePieStore((state) => state.loadSnippets);
  const copySnippet = usePieStore((state) => state.copySnippet);
  const openShortcutForm = usePieStore((state) => state.openShortcutForm);

  // A pinned donut may not get focus after a change in the settings window.
  useEffect(() => {
    void loadSnippets();
  }, [loadSnippets]);

  return (
    <PieListCard
      sliceIndex={SNIPPETS_INDEX}
      label="Snippets"
      foot={
        <button
          type="button"
          className="pie-list-foot-button"
          onClick={() => openShortcutForm({ kind: 'snippet-new' })}
        >
          <PieIcon type="add" size={14} />
          Snippet
        </button>
      }
    >
      {snippets.length === 0 && (
        <li className="pie-list-empty">No snippets yet</li>
      )}
      {snippets.map(({ id, label, content }, index) => (
        <li key={id} className="pie-list-entry">
          <button
            type="button"
            className="pie-list-row"
            style={{ '--i': index } as CSSProperties}
            role="menuitem"
            onClick={() => void copySnippet(id)}
          >
            <span className="pie-list-tile">
              <PieIcon type="snippet" />
            </span>
            <span className="pie-list-text">
              <span className="pie-list-label">{label}</span>
              <span className="pie-list-detail">
                {snippetPreview(content) || 'Empty'}
              </span>
            </span>
            <span className="pie-list-action">Copy</span>
          </button>
          <button
            type="button"
            className="pie-list-add-inside"
            aria-label={`Edit ${label}`}
            title="Edit"
            onClick={() => openShortcutForm({ kind: 'snippet-edit', id })}
          >
            <PieIcon type="edit" size={14} />
          </button>
        </li>
      ))}
    </PieListCard>
  );
}
