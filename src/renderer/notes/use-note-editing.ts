import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Repeat } from '../../shared/reminder-time';
import type { Note } from '../../shared/types';
import { NoteSaver } from './note-saver';
import { notesBridge } from './notes-bridge';
import { displayTitle, isBlank, withSavedNote } from './notes-view';

const SAVE_AFTER_MS = 500;

// The note being edited: its text, saving it as you type and before the
// window closes, leaving it, deleting it and its reminder. The window around
// it only draws.
export function useNoteEditing(
  notes: Note[],
  setNotes: Dispatch<SetStateAction<Note[]>>,
) {
  // Whether the editor shows a note, saved or new.
  const [isEditing, setIsEditing] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The latest text, for saves that run after a render.
  const textRef = useRef({ title: '', body: '' });
  const saverRef = useRef<NoteSaver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Read by `leave`, so it, `show` and the memoized list stay the same
  // across saves.
  const notesRef = useRef(notes);
  notesRef.current = notes;

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
      const stored = notesRef.current.find(({ id }) => id === saver.noteId);
      if (!stored?.reminder) {
        await notesBridge.remove(saver.noteId);
      }
    }
    saverRef.current = null;
  }, [flush]);

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
        // Main doesn't echo this window's own saves, so the list is patched.
        (saved) => setNotes((current) => withSavedNote(current, saved)),
      );
      setIsEditing(true);
      if (note === null) {
        // A new note starts in its title.
        requestAnimationFrame(() => titleInputRef.current?.focus());
      }
    },
    [leave],
  );

  // Main holds the close until this answers.
  useEffect(() => notesBridge.onSaveRequested(flush), [flush]);

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

  return {
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
  };
}
