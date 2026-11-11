# Shortcuts slice: plan

Date: 2026-11-09

## What we are building

The donut gets a new slice called **Shortcuts**. Put the mouse on it and circles pop out. Each circle opens a website or an app, or holds a group of them.

## What the user sees

### The slice

- Shortcuts sits just before Settings in the ring.
- It does not count toward the 8 slices.
- Clicking the slice itself opens the Shortcuts part of the Settings window.
- It shows only when the ring shows the other built-in slice, Settings.

### The circles

- The row shows up to 8 shortcuts and groups.
- After them come two more circles: **Add shortcut** and **Add group**.
- A shortcut circle shows the first letter of its name. A group circle shows a folder icon.
- With the mouse on a circle, the middle of the donut shows its full name and its kind (Link, App or Group).
- Clicking a shortcut opens it. Then the donut closes, unless it is pinned.
- If a shortcut cannot open, the middle of the donut says why.

### Groups

- With the mouse on a group for about 180 ms, the row changes to show what is inside.
- The short wait stops groups from opening when the mouse only passes over them.
- Inside a group, the row shows up to 8 shortcuts, then **Add shortcut** and **Back**.
- **Back** works by click.
- A group cannot hold another group.
- Moving the mouse away from the Shortcuts slice closes the row. The next time, it starts at the top level again.

### Adding and changing

- **Add shortcut** and **Add group** open the Settings window with the form ready.
- **Add shortcut** inside a group adds to that group.
- The Settings window gets a new **Shortcuts** part. It can add, edit, remove and move shortcuts and groups.
- The form for a shortcut asks for a name, a kind (Link or App), and the web address or the app.
- If a web address has no `http://` or `https://`, the form adds `https://`.
- Removing a group that has shortcuts inside asks first, because they are removed too.
- A name can have up to 24 letters.

## Safety

- A link must use `http` or `https`. The app checks this when saving, and again every time it opens one. `file:` and script links are refused.
- An app must be on the allowed apps list. Saving an app shortcut in the Settings window adds it to the list, the same as an app slice.
- The allowed apps list will not remove an app that a shortcut still uses.

## Not in this work

- Website icons or real app icons.
- Moving through the circles with the keyboard. The Settings circles cannot do this today either.
- Groups inside groups.

## How it is built

### Storage

A new migration, `002_shortcuts.sql`, adds one table. Existing data is not changed.

```sql
CREATE TABLE shortcuts (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('link', 'app', 'group')),
  target      TEXT,
  parent_id   TEXT REFERENCES shortcuts (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`target` is empty only for a group. `parent_id` is empty at the top level. Positions are counted separately inside each parent.

### Main process

- `src/shared/schemas/shortcut.schema.ts`: the shape of a shortcut, the limit of 8, and the link rule.
- `ShortcutRepository`: reads and writes the table.
- `ShortcutService`: the rules for limits, for no group inside a group, and for opening. It is given `openPath` and `openExternal`, like `SliceService` is given `openPath`.
- `SliceService.removeAllowedApp` also refuses when a shortcut uses the app.
- New messages: the donut can list and open shortcuts. The Settings window can list, add, edit, remove and move them.
- Opening the form: the donut asks the main process to open the Settings window with a form request (a new shortcut, a new group, or a new shortcut in one group). The main process keeps the request. The Settings window picks it up when it loads and when told a request is waiting.

### Donut

- The ring has two built-in slices. Shortcuts is at index `slices.length` and Settings moves to `slices.length + 1`. The code that assumes Settings is at `slices.length` changes too: `PieSlice`, `PieCenter`, `PieMenu`, `usePieKeyboard` and `PieSettingsFan`.
- The row drawing moves out of `PieSettingsFan` into a shared fan component, used by Settings and Shortcuts. It keeps the same look and animations.
- `PieShortcutsFan` keeps which group is open. If that group no longer exists after a reload, it goes back to the top level.
- The pie store also loads the shortcuts, and opens them the same way as slices.

### Settings window

- `ShortcutSection` and `ShortcutForm`, following `SliceSection` and `SliceForm`.

## Testing

- Unit tests: the link rule, limits, no group inside a group, removing a group, the allowed apps check, opening each kind, and the checks on each new message.
- A database test: an existing database at version 1 moves to version 2 and keeps its slices, and is not treated as a first run.
- A real app test on a separate copy with its own data: hover, open a group, go back, open a shortcut with the final open step faked, and use the add circles.
