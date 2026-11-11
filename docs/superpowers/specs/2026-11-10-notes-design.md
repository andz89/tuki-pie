# Notes slice: design

Date: 2026-11-10

## What we are building

A new **Notes** slice on the donut. Clicking it opens a Notes window where you write plain-text notes. Any note can have one reminder. When it is due, a small card pops up at the top right of the screen with **Open note**, **Snooze 10 min** and **Done**. The reminders follow Tuki's notes reminders.

Decisions taken with the user:

- Notes live in their own window, not in Settings.
- The slice just opens the window. No circles.
- The reminder is a card at the top right, not a Windows notification.
- Repeats are like Tuki: once, every day, every weekday, every week.

## What the user sees

### The slice

- Notes sits between Page Info and Settings, so the slices people already know keep their place: Screenshot, Snippets, Shortcuts, Apps, Page Info, **Notes**, Settings.
- The center shows "Notes" and "Notes and reminders". Its icon is the existing `note` icon.
- Clicking the slice, or pressing Enter on it, closes the donut and opens the Notes window. If it is open already, it comes to the front.

### The Notes window

```
┌ Notes ────────────────────────────────────────────┐
│ [🔎 Search notes      ] [+]│ Italy trip            │
│ Italy trip          🔔 9:00│ ───────────────────── │
│ Groceries                  │ - book hotel          │
│ Ideas                      │ - flights             │
│                            │                       │
│                            │ 🔔 Tomorrow 9:00 ·    │
│                            │    every weekday  [✕] │
│                            │ [Remind me ▾] [Delete]│
└───────────────────────────────────────────────────┘
```

- Left: a search box, a **New note** button, and the notes, the most recently changed first. A note with a reminder shows a bell and when it is next due.
- Search keeps notes whose title or text contains every word typed, ignoring case.
- Right: the open note. A title line and a plain-text area. Changes save by themselves half a second after you stop typing, and when you switch notes or close the window.
- A new note starts empty with the cursor in the title. A note left with no title and no text is not kept.
- **Delete** asks first ("Delete Italy trip?").
- The window uses the app's theme and accent color, like Page Info.
- With no notes yet, the right side says "No notes yet." with a **New note** button.

### Setting a reminder

**Remind me** opens a small menu:

- In 1 hour
- Today 17:00 (only before 17:00)
- Tomorrow 9:00
- Monday 9:00 (the next Monday)
- Pick a date and time… (a date-and-time field and **Set**)

and a **Repeat** choice: Once, Every day, Every weekday (Monday to Friday), Every week.

- The note then shows "🔔 Tomorrow 9:00 · every weekday" with a ✕ to remove the reminder.
- A time in the past is refused: "Pick a time in the future."
- Times are in the computer's local time.

### The reminder card

```
┌───────────────────────────────┐
│ 🔔 Italy trip                  │
│ - book hotel - flights         │
│ [Open note] [Snooze 10 min] [Done] │
└───────────────────────────────┘
```

- It appears at the top right of the main screen, above other windows, without taking the keyboard away from what you are doing.
- It shows the note's title and the start of its text (up to 80 characters, line breaks as spaces).
- It stays until you click one of its buttons. Several due reminders stack in the same card, oldest first.
- **Done**: a one-time reminder is removed. A repeating one moves to its next time.
- **Snooze 10 min**: the card goes away and comes back in 10 minutes. A repeating reminder keeps its own times.
- **Open note**: counts as Done, and opens the note in the Notes window.
- If the note is deleted while its card shows, its card entry goes away.
- A reminder that came due while the app was closed pops up when the app starts.
- Reminders only pop up while Pie Launcher is running (it lives in the tray).

## Limits

- Title up to 200 characters, text up to 100,000 characters, 1,000 notes at most.
- Plain text only. One reminder per note.
- Stored unencrypted in the app's local database, like everything else.

## Not in this work

- Folders, checklists, formatting, images.
- Reminders shown while the app is not running, or Windows notifications.
- Syncing with Tuki or other computers.
- A keyboard shortcut to open Notes.

## How it is built

### Storage

New migration `006_notes.sql`:

```sql
CREATE TABLE notes (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  remind_at      TEXT,               -- the reminder's time, ISO in UTC
  remind_repeat  TEXT NOT NULL DEFAULT 'once',
  snoozed_until  TEXT,               -- ISO in UTC, set by Snooze
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

A reminder is due at `snoozed_until` when set, otherwise at `remind_at`.

### Shared

- `shared/schemas/note.schema.ts`: `Note`, `NoteEdit`, `Reminder` (`{ at: string; repeat: 'once' | 'daily' | 'weekdays' | 'weekly' }`) and the limits.
- `shared/reminder-time.ts`, pure and tested: the quick picks for a given "now", `nextOccurrence(anchor, repeat, after)` in local time, and the "Tomorrow 9:00 · every weekday" wording.

### Main process

- `NoteRepository` (SQL) and `NoteService` (rules, limits, Done, Snooze).
- `ReminderScheduler`: finds the next due time and sets one timer for it (checked again at least every hour, so a sleeping computer catches up). On start, and after every change, it looks again. Due notes go to the card.
- `notes-window.ts` opens or focuses the Notes window, and can ask it to open one note.
- `reminder-window.ts` shows the frameless, always-on-top card at the top right with `showInactive()`. The card tells main its height so the window fits.
- IPC for the Notes window (list, create, update, remove, set reminder, a "notes changed" event and an "open this note" event) and for the card (due list, open, snooze, done).

### Renderer

- `notes.html` with `notes/NotesWindow.tsx`, its store and preload.
- `reminder.html` with `reminder/ReminderCard.tsx` and its preload.
- The donut gets the new ring item and `openNotes`.

### Tests

Reminder times (quick picks, each repeat across week and month ends), the service (limits, Done for once and repeating, Snooze, empty notes not kept), the scheduler (timer, catch-up on start), the repository, the IPC input checks, and the ring order.
