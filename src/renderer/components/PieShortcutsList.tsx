import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Shortcut } from '../../shared/types';
import { usePieStore } from '../stores/pie.store';
import { PieListCard } from './PieListCard';
import { PieIcon } from './icons/SliceIcon';
import { shortcutDetail, shortcutTree } from './shortcut-row';
import { SHORTCUTS_INDEX } from './slice-display';

export function PieShortcutsList() {
  const shortcuts = usePieStore((state) => state.shortcuts);
  const loadShortcuts = usePieStore((state) => state.loadShortcuts);
  const openShortcut = usePieStore((state) => state.openShortcut);
  const openShortcutForm = usePieStore((state) => state.openShortcutForm);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());

  // A pinned donut may not get focus after a change in the settings window.
  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  const toggleGroup = (id: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  // Links and groups. Apps have their own slice.
  const tree = shortcutTree(shortcuts.filter(({ type }) => type !== 'app'));
  let rowIndex = 0;

  const itemRow = (shortcut: Shortcut, nested: boolean) => (
    <li key={shortcut.id}>
      <button
        type="button"
        className={nested ? 'pie-list-row is-nested' : 'pie-list-row'}
        style={{ '--i': rowIndex++ } as CSSProperties}
        role="menuitem"
        onClick={() => void openShortcut(shortcut.id)}
      >
        <span className="pie-list-tile">
          <PieIcon type={shortcut.type === 'path' ? 'folder' : 'shortcut'} />
        </span>
        <span className="pie-list-text">
          <span className="pie-list-label">{shortcut.label}</span>
          <span className="pie-list-detail">{shortcutDetail(shortcut)}</span>
        </span>
        <span className="pie-list-action">Open</span>
      </button>
    </li>
  );

  return (
    <PieListCard
      sliceIndex={SHORTCUTS_INDEX}
      label="Shortcuts"
      foot={
        <>
          <button
            type="button"
            className="pie-list-foot-button"
            onClick={() =>
              openShortcutForm({ kind: 'shortcut', parentId: null })
            }
          >
            <PieIcon type="add" size={14} />
            Shortcut
          </button>
          <button
            type="button"
            className="pie-list-foot-button"
            onClick={() => openShortcutForm({ kind: 'group' })}
          >
            <PieIcon type="add-group" size={14} />
            Group
          </button>
        </>
      }
    >
      {tree.length === 0 && (
        <li className="pie-list-empty">No shortcuts yet</li>
      )}
      {tree.map(({ shortcut, children }) => {
        if (shortcut.type !== 'group') {
          return itemRow(shortcut, false);
        }
        const isOpen = openGroups.has(shortcut.id);
        return (
          <li key={shortcut.id}>
            <div
              className={isOpen ? 'pie-list-group is-open' : 'pie-list-group'}
            >
              <button
                type="button"
                className="pie-list-row"
                style={{ '--i': rowIndex++ } as CSSProperties}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(shortcut.id)}
              >
                <span className="pie-list-chevron">
                  <PieIcon type="chevron" size={14} />
                </span>
                <span className="pie-list-folder">
                  <PieIcon type="folder" />
                </span>
                <span className="pie-list-label">{shortcut.label}</span>
                <span className="pie-list-count">{children.length}</span>
              </button>
              <button
                type="button"
                className="pie-list-add-inside"
                aria-label={`Add a shortcut to ${shortcut.label}`}
                title="Add here"
                onClick={() =>
                  openShortcutForm({
                    kind: 'shortcut',
                    parentId: shortcut.id,
                  })
                }
              >
                <PieIcon type="add" size={14} />
              </button>
            </div>
            {isOpen && (
              <ul className="pie-list-children">
                {children.length === 0 ? (
                  <li className="pie-list-empty is-nested">Empty group</li>
                ) : (
                  children.map((child) => itemRow(child, true))
                )}
              </ul>
            )}
          </li>
        );
      })}
    </PieListCard>
  );
}
