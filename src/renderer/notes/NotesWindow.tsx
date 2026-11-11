import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { describeReminder, describeTime } from '../../shared/reminder-time';
import type { Repeat } from '../../shared/reminder-time';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { Note, Settings } from '../../shared/types';
import { PieIcon } from '../components/icons/SliceIcon';
import { NoteSaver } from './note-saver';
import { notesBridge } from './notes-bridge';
import {
  displayTitle,
  filterNotes,
  isBlank,
  listPreview,
  nextRing,
} from './notes-view';
import { ReminderMenu } from './ReminderMenu';

const SAVE_AFTER_MS = 500;
// Keeps "Today 17:00" and the like true as time passes.
const CLOCK_TICK_MS = 30000;

export function NotesWindow() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  // Whether the editor shows a note, saved or new.
  const [isEditing, setIsEditing] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // The latest text, for saves that run after a render.
  const textRef = useRef({ title: '', body: '' });
  const saverRef = useRef<NoteSaver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async (cleanUp = false) => {
    const result = await notesBridge.list(cleanUp);
    if (result.ok) {
      setNotes(result.value);
    }
  }, []);

  // Saves what is typed now, without waiting for the pause.
  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    const saver = saverRef.current;
    if (saver) {
      const { title: t, body: b } = textRef.current;
      await saver.save(t, b);
      setNoteId(saver.noteId);
    }
  }, []);

  // Leaving a note saves it, and drops it if it was left blank.
  const leave = useCallback(async () => {
    await flush();
    const saver = saverRef.current;
    const { title: t, body: b } = textRef.current;
    if (saver?.noteId && isBlank(t, b)) {
      const stored = notes.find(({ id }) => id === saver.noteId);
      if (!stored?.reminder) {
        await notesBridge.remove(saver.noteId);
      }
    }
    saverRef.current = null;
  }, [flush, notes]);

  const show = useCallback(
    async (note: Note | null) => {
      await leave();
      const text = { title: note?.title ?? '', body: note?.body ?? '' };
      textRef.current = text;
      setTitle(text.title);
      setBody(text.body);
      setNoteId(note?.id ?? null);
      setError(null);
      saverRef.current = new NoteSaver(
        notesBridge,
        note?.id ?? null,
        text,
        (message) => setError(message),
      );
      setIsEditing(true);
      if (note === null) {
        // A new note starts in its title.
        requestAnimationFrame(() => titleInputRef.current?.focus());
      }
    },
    [leave],
  );

  const showRequested = useCallback(async () => {
    const request = await notesBridge.takeRequest();
    if (!request.ok || request.value === null) {
      return;
    }
    const listed = await notesBridge.list(false);
    if (!listed.ok) {
      return;
    }
    setNotes(listed.value);
    const note = listed.value.find(({ id }) => id === request.value);
    if (note) {
      await show(note);
    }
  }, [show]);

  // Start: the look, the notes, and any note the donut or a card asked for.
  useEffect(() => {
    const loadLook = async () => {
      const result = await notesBridge.settings.get();
      if (result.ok) {
        setSettings(result.value);
      }
    };
    void loadLook();
    void reload(true).then(() => showRequested());
    const onFocus = () => void loadLook();
    window.addEventListener('focus', onFocus);
    const tick = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(tick);
    };
    // Runs once, when the window opens.
  }, []);

  useEffect(() => notesBridge.onChanged(() => void reload()), [reload]);
  useEffect(
    () => notesBridge.onOpenRequested(() => void showRequested()),
    [showRequested],
  );

  // Closing the window or switching away saves right away.
  useEffect(() => {
    const save = () => void flush();
    window.addEventListener('blur', save);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('blur', save);
      window.removeEventListener('pagehide', save);
    };
  }, [flush]);

  const edit = (nextTitle: string, nextBody: string) => {
    textRef.current = { title: nextTitle, body: nextBody };
    setTitle(nextTitle);
    setBody(nextBody);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${displayTitle(title)}?`)) {
      return;
    }
    clearTimeout(timerRef.current);
    const id = saverRef.current?.noteId ?? null;
    saverRef.current = null;
    setIsEditing(false);
    setNoteId(null);
    if (id !== null) {
      const result = await notesBridge.remove(id);
      if (!result.ok) {
        setError(result.error);
      }
    }
  };

  const setReminder = async (at: Date | null, repeat: Repeat = 'once') => {
    await flush();
    const id = saverRef.current?.noteId;
    if (!id) {
      return;
    }
    const result = await notesBridge.setReminder(
      id,
      at === null ? null : { at: at.toISOString(), repeat },
    );
    setError(result.ok ? null : result.error);
  };

  const open = notes.find(({ id }) => id === noteId) ?? null;
  const shown = filterNotes(notes, query);
  const ring = open ? nextRing(open) : null;
  const canRemind = noteId !== null || !isBlank(title, body);

  return (
    <div
      className="panel notes"
      data-theme={settings.theme}
      style={{ '--accent': settings.accent } as CSSProperties}
    >
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
            onClick={() => void show(null)}
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
                    note.id === noteId ? 'notes-item is-open' : 'notes-item'
                  }
                  aria-current={note.id === noteId}
                  onClick={() => void show(note)}
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

      <main className="notes-editor">
        {error && (
          <p className="panel-error" role="alert">
            {error}
            <button
              type="button"
              className="button-quiet"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </p>
        )}

        {!isEditing ? (
          <div className="notes-blank">
            <p>{notes.length === 0 ? 'No notes yet.' : 'Pick a note.'}</p>
            <button
              type="button"
              className="button-primary"
              onClick={() => void show(null)}
            >
              New note
            </button>
          </div>
        ) : (
          <>
            <input
              ref={titleInputRef}
              type="text"
              className="notes-title"
              placeholder="Title"
              aria-label="Title"
              maxLength={200}
              value={title}
              onChange={(event) => edit(event.target.value, body)}
            />
            <textarea
              className="notes-body"
              placeholder="Write your note"
              aria-label="Note"
              maxLength={100000}
              value={body}
              onChange={(event) => edit(title, event.target.value)}
            />

            {open?.reminder && ring && (
              <p className="notes-reminder">
                <span>
                  🔔{' '}
                  {describeReminder(
                    new Date(open.reminder.at),
                    open.reminder.repeat,
                    now,
                  )}
                  {open.snoozedUntil &&
                    ` · snoozed until ${describeTime(ring, now)}`}
                </span>
                <button
                  type="button"
                  className="button-icon"
                  aria-label="Remove reminder"
                  title="Remove reminder"
                  onClick={() => void setReminder(null)}
                >
                  <PieIcon type="close" size={14} />
                </button>
              </p>
            )}

            <div className="notes-actions">
              <ReminderMenu
                disabled={!canRemind}
                repeat={open?.reminder?.repeat ?? 'once'}
                onPick={(at, repeat) => void setReminder(at, repeat)}
              />
              <button
                type="button"
                className="button-quiet notes-delete"
                onClick={() => void remove()}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
