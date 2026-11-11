import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  NewNote,
  Note,
  NoteEdit,
  Reminder,
} from '../../shared/schemas/note.schema';
import type { NoteService } from '../services/note.service';
import { withoutEcho } from '../windows/notes-echo';
import { openNotesWindow, takeNoteRequest } from '../windows/notes-window';
import { dueReminders, fitReminderCard } from '../windows/reminder-window';
import { handle } from './handle';

const Id = Note.shape.id;
const NoInput = z.tuple([]);
const CardHeight = z.number().int().min(0).max(10000);

// The Notes window.
export function registerNotesIpc(notes: NoteService): void {
  // The window asks to clean up once, when it opens: never while a note is
  // being edited, which may be blank for a moment.
  handle(IpcChannels.notesList, z.tuple([z.boolean()]), (cleanUp) =>
    cleanUp ? notes.listAfterCleanup() : notes.list(),
  );

  // The window puts the saved note into its own list from the answer.
  handle(IpcChannels.notesCreate, z.tuple([NewNote]), (item) =>
    withoutEcho(() => notes.create(item)),
  );

  handle(IpcChannels.notesUpdate, z.tuple([NoteEdit]), (edit) =>
    withoutEcho(() => notes.update(edit)),
  );

  handle(IpcChannels.notesRemove, z.tuple([Id]), (id) => notes.remove(id));

  handle(
    IpcChannels.notesSetReminder,
    z.tuple([Id, Reminder.nullable()]),
    (id, reminder) => notes.setReminder(id, reminder),
  );

  handle(IpcChannels.notesTakeRequest, NoInput, () => takeNoteRequest());
}

// The reminder card.
export function registerReminderIpc(notes: NoteService): void {
  handle(IpcChannels.reminderList, NoInput, () => dueReminders());

  // Opening the note counts as Done.
  handle(IpcChannels.reminderOpen, z.tuple([Id]), (id) => {
    notes.done(id);
    openNotesWindow(id);
  });

  handle(IpcChannels.reminderSnooze, z.tuple([Id]), (id) => notes.snooze(id));

  handle(IpcChannels.reminderDone, z.tuple([Id]), (id) => notes.done(id));

  handle(IpcChannels.reminderFit, z.tuple([CardHeight]), (height) =>
    fitReminderCard(height),
  );
}
