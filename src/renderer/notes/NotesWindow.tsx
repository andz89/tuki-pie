import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { describeReminder, describeTime } from '../../shared/reminder-time';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { Note, Settings } from '../../shared/types';
import { PieIcon } from '../components/icons/SliceIcon';
import { notesBridge } from './notes-bridge';
import { NotesSidebar } from './NotesSidebar';
import { isBlank, nextRing } from './notes-view';
import { ReminderMenu } from './ReminderMenu';
import { useNoteEditing } from './use-note-editing';

// Keeps "Today 17:00" and the like true as time passes.
const CLOCK_TICK_MS = 30000;

export function NotesWindow() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notes, setNotes] = useState<Note[]>([]);
  const {
    isEditing,
    noteId,
    title,
    body,
    error,
    setError,
    titleInputRef,
    show,
    edit,
    remove,
    setReminder,
  } = useNoteEditing(notes, setNotes);
  const [now, setNow] = useState(() => new Date());

  const reload = useCallback(async (cleanUp = false) => {
    const result = await notesBridge.list(cleanUp);
    if (result.ok) {
      setNotes(result.value);
    }
  }, []);

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

  const showNote = useCallback((note: Note | null) => void show(note), [show]);
  const open = notes.find(({ id }) => id === noteId) ?? null;
  const ring = open ? nextRing(open) : null;
  const canRemind = noteId !== null || !isBlank(title, body);

  return (
    <div
      className="panel notes"
      data-theme={settings.theme}
      style={{ '--accent': settings.accent } as CSSProperties}
    >
      <NotesSidebar notes={notes} openId={noteId} now={now} onShow={showNote} />

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
