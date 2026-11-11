import { memo, useMemo, useState } from 'react';
import { describeTime } from '../../shared/reminder-time';
import type { Note } from '../../shared/types';
import { PieIcon } from '../components/icons/SliceIcon';
import { displayTitle, filterNotes, listPreview, nextRing } from './notes-view';

interface NotesSidebarProps {
  notes: Note[];
  openId: string | null;
  now: Date;
  onShow: (note: Note | null) => void;
}

// The search box and the list of notes. Memoized, with its own search text,
// so typing in a note doesn't redraw every note in the list.
export const NotesSidebar = memo(function NotesSidebar({
  notes,
  openId,
  now,
  onShow,
}: NotesSidebarProps) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterNotes(notes, query), [notes, query]);

  return (
    <aside className="notes-side">
      <div className="notes-side-bar">
        <div className="notes-search">
          <span className="notes-search-icon">
            <PieIcon type="search" size={14} />
          </span>
          <input
            type="search"
            value={query}
            placeholder="Search notes"
            aria-label="Search notes"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="button-primary notes-new"
          aria-label="New note"
          title="New note"
          onClick={() => onShow(null)}
        >
          <PieIcon type="add" size={16} />
        </button>
      </div>

      {notes.length > 0 && shown.length === 0 && (
        <p className="notes-empty-list">No note contains "{query.trim()}".</p>
      )}
      <ul className="notes-list">
        {shown.map((note) => {
          const time = nextRing(note);
          return (
            <li key={note.id}>
              <button
                type="button"
                className={
                  note.id === openId ? 'notes-item is-open' : 'notes-item'
                }
                aria-current={note.id === openId}
                onClick={() => onShow(note)}
              >
                <span className="notes-item-title">
                  {displayTitle(note.title)}
                </span>
                {time && (
                  <span className="notes-item-bell">
                    🔔 {describeTime(time, now)}
                  </span>
                )}
                <span className="notes-item-preview">
                  {listPreview(note.body)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
});
