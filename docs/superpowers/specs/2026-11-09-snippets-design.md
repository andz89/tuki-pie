# Snippets slice: design

Date: 2026-11-09

## What we are building

The Snippets slice on the donut stops being a placeholder. A snippet is a named piece of saved text. Put the mouse on the slice and circles pop out, one per snippet. Clicking a circle copies that snippet's text to the clipboard.

## What the user sees

### The slice

- Snippets keeps its place in the ring, after Screenshot.
- The center shows "Snippets" and "Saved text" in place of "Coming soon".
- Clicking the slice itself, or pressing Enter on it, opens the Snippets part of the Settings window.

### The circles

- The row shows up to 8 snippets, in their saved order.
- After them come **Add** and **Edit**. **Edit** is left out when there are no snippets.
- A snippet circle shows the first letter of its name.
- With the mouse on a snippet, the center shows its name and a preview of its text: line breaks become spaces, and the preview stops at 30 characters with "…".
- Moving the mouse away from the slice closes the row.

### Copying

- Clicking a snippet copies its exact text, with its line breaks and spacing unchanged.
- The donut then closes.
- A pinned donut stays open, and the center shows "Copied" for about 1.2 seconds.
- If the copy fails, or the snippet no longer exists, the center says why and the donut stays open.

### Adding and editing

- **Add** opens the Settings window with a new snippet form ready.
- **Edit** turns on edit mode. The Edit circle stays highlighted, and its hint reads "Pick a snippet to edit".
- In edit mode, a snippet's hint reads "Click to edit", and clicking it opens that snippet's form in Settings without copying.
- Clicking **Edit** again, or moving off the slice, ends edit mode.
- If the snippet was removed before its form opens, Settings says "That snippet no longer exists."

### The Snippets part of Settings

- It sits between Shortcuts and Appearance.
- The heading shows the count, such as "3 of 8", and an **Add snippet** button that is disabled at 8.
- Each row shows the name and a one-line preview, with move up, move down, **Edit** and **Remove**.
- Removing a snippet does not ask first, the same as removing a single shortcut.
- The form has **Name** (up to 24 characters) and **Text** (several lines, up to 10,000 characters).
- Both are required, and text of only spaces or line breaks does not count.

## Limits

- At most 8 snippets, so the circles fit in one row. The main process enforces this and answers "You can save 8 snippets at most."
- Plain text only.
- Snippets are stored unencrypted in the app's local database, like everything else the app saves.

## Not in this work

- Images or formatted text.
- Groups of snippets.
- Moving through the circles with the keyboard. The other circle rows cannot do this today either.
- Pasting the text into the app underneath. The person pastes it themselves.
- Encrypted storage.

## How it is built

### Storage

New migration `003_snippets.sql`:

```sql
CREATE TABLE snippets (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  content     TEXT NOT NULL,
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Shared

`src/shared/schemas/snippet.schema.ts` holds `MAX_SNIPPETS = 8`, `MAX_SNIPPET_LENGTH = 10000`, and the zod schemas `Snippet`, `NewSnippet` and `SnippetEdit`.

`PanelFormRequest` gains three kinds: `snippet-new`, `snippet-edit` with an `id`, and `snippets-section`.

### Main process

- `SnippetRepository` follows `ShortcutRepository`: `findAll`, `findById`, `count`, `insert`, `update`, `remove`, `setOrder`.
- `SnippetService` has `list`, `add`, `update`, `remove`, `reorder` and `copy`. It receives the clipboard writer as a function, so tests need no Electron.
- `copy` takes an id, and the text comes from the database, the same rule as opening a shortcut.
- `snippets.ipc.ts` validates every message with zod through `handle()`. The add, update, remove and reorder messages are registered as panel messages, like the shortcut ones.

### Donut

- `RING_ITEMS` changes the Snippets description, and `SNIPPETS_INDEX` is added.
- `pie.store` gains `snippets`, `loadSnippets`, `copySnippet` and a `notice` for "Copied". The notice is set only when pinned and clears itself by timer, so a reload caused by clicking a pinned donut cannot wipe it.
- `PieSnippetsFan` builds the circles and keeps edit mode as its own state, so leaving the slice ends edit mode by unmounting.
- `PieFanRow` gains an optional highlighted state for a circle, and `SliceIcon` gains an `edit` icon.
- `.pie-center-type` gets a width limit and a two-line clamp, so a preview stays inside the center.

### Settings window

- `SnippetSection` and `SnippetForm` follow the Shortcuts ones, and `panel.store` gains the snippet actions.
- `ShortcutSection` currently clears every form request. It must clear only the kinds it handles, or it would swallow the snippet ones.
- `SettingsPanel` must finish `load` before picking up a form request, so `snippet-edit` finds the snippet on a freshly opened window.

## Testing

Tests are written first with vitest:

- Schema: limits, and rejecting blank text.
- Service: 8-snippet limit, copy writes the stored text exactly, missing snippet errors, reorder rejects a changed list.
- IPC: bad input is refused.
- `pie.store`: copy dismisses, pinned shows "Copied", a failed copy shows the error and keeps the donut open.
- Preview helper: line breaks, the 30-character cut, and emoji staying whole.
- `panel.store`: the snippet actions, and a snippet request surviving `ShortcutSection`'s handling.
- Migration: the table exists after upgrading a database at the previous version.

The look of the circles and the real clipboard need a manual check in the running app.
