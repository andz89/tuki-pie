# Suggestions: design

Date: 2026-11-10

## What we are building

Values you type often (dates, times, names, codes), saved in named groups in Pie Launcher. In Chrome, clicking an input field, text area or select box shows a dropdown under it with those values, under their group names. Picking one fills the field.

This is the Suggestions feature from Tuki, moved into Pie Launcher. The values are stored in Pie Launcher's database and managed in Settings. The Pie Chrome extension shows the dropdown.

## What the user sees

### The dropdown in Chrome

- Clicking an input, text area or select on any web page, including inside iframes, opens a dropdown just below it.
- The dropdown lists every group that has a visible value, with the group name as a small grey heading and its values below.
- A value with a label shows the label in grey on the right ("06" ... "June").
- The value already in the field is shown in bold on a light blue background.
- Picking a value fills the field the way typing would, so pages built with React or Vue notice it. Focus stays in the field.
- Tabbing into a field opens the dropdown too. A page focusing a field by itself does not.
- Esc, clicking somewhere else, or leaving the field closes it. It follows the field when the page scrolls.
- Fields that are disabled or read-only, and checkboxes, radio buttons, buttons, file, color, range and hidden inputs, never get a dropdown.

### Select boxes

- Only values that match one of the select's options are offered: by option value, by option text, or by the start of the option text ("06" picks "06-Jun").
- When nothing matches, the normal Chrome list opens as usual.
- When something matches, Pie's dropdown opens in place of Chrome's, with **Show all...** at the bottom to open Chrome's own list.

### Filling several fields

- Shift+click a field to add it to a selection. Selected fields get a blue outline. Shift+click again removes it.
- With two or more selected, the dropdown says "Pick one value for all, or fill a group in order:".
- Picking a value fills every selected field with it.
- Each group gets a blue **Fill in order (n)** button: it fills the selected fields, top of the page first, with that group's values in order. n is the smaller of the number of fields and the number of values. Hovering it lists what goes where.
- A normal click or Esc clears the selection.

```
  Date of birth  [ 13          ]
                 ┌──────────────────────┐
                 │ DAY                  │
                 │ 01                   │
                 │ 13            Friday │  <- current value, bold
                 │ MONTH                │
                 │ 02          February │
                 │ 06              June │
                 └──────────────────────┘
```

### The Suggestions tab in Settings

A new **Suggestions** tab sits after **Snippets**. It works like Tuki's Suggestions tab.

```
 Suggestions
 Values you type often, in named groups. ...
 [ New group, e.g. "Date"          ] [Add group]
 [x] Show the list on input fields in Chrome
 Drag groups to change their order. Drag values to reorder them or move
 them to another group. Click a name, value or label to change it.

 ┌─────────────────────────────────────────────────────────┐
 │ ⠿ ▾ Day 2                              Hide all  Delete │
 │ [ Add a value, or several: "13, 02, 00" ] [Add]         │
 │ ┌─────────────────────────────────────────────────────┐ │
 │ │ ⠿ 01                         + label   Hide  Delete │ │
 │ │ ⠿ 13                        (Friday)   Hide  Delete │ │
 │ └─────────────────────────────────────────────────────┘ │
 └─────────────────────────────────────────────────────────┘
```

- **Show the list on input fields in Chrome** turns the dropdown on or off everywhere. It is on by default. Turn it off if Tuki is still showing its own dropdown.
- Click a group name, a value or a label to change it in place. Enter or clicking away saves, Esc cancels. An empty group name or value keeps the old one; an empty label removes it.
- **+ label** adds an optional label (up to 40 characters), shown as a pill.
- Drag a group by its header to reorder groups. Drag a value to reorder it, or onto another group to move it there, before the row it is dropped on, or at the end when dropped on the group itself. Its label and hidden mark go with it. If that group already has the value, the two become one.
- The ▾/▸ arrow folds a group. Folding only affects Settings; the dropdown still offers the group.
- **Add** takes several values at once, separated by commas. Values a group already has are skipped.
- **Hide** keeps a value saved but leaves it out of the dropdown. Hidden values are shown struck through with **Show**. **Hide all** / **Show all** does this for a whole group.
- A value can be in more than one group. Within one group, each value appears once.
- **Delete** on a value does not ask first. **Delete** on a group that still has values asks first ("Delete the group "Day" and its 12 values?").
- A note shows when the extension is not connected: "Chrome isn't connected. Changes reach Chrome once it is."

### When the app is closed

The extension keeps the last list it received, so the dropdown keeps working in Chrome while Pie Launcher is closed. Changes made in Settings reach Chrome the next time they are connected.

## Limits

- Up to 50 groups, 200 values per group.
- A group name up to 40 characters, a value up to 200, a label up to 40.
- Plain text, one line. Line breaks in pasted values become spaces.
- The main process enforces these and says which limit was hit.

## Privacy

- The dropdown is drawn in a closed shadow root, so the page's own scripts can't read the values in it.
- It only opens for real clicks and Tab presses from the person (trusted events), so a page can't open it by script and read what it fills.
- Values are only written into a field when the person picks one.
- The app sends the list to the extension only over the existing paired connection. The extension accepts it only from the paired app and checks its shape before saving it.
- The extension saves the list in its local Chrome storage, the same way Tuki did. Like everything else in Pie Launcher, nothing is encrypted.

## Not in this work

- Showing suggestions outside Chrome (option 2 from the discussion). The data model leaves room for it later.
- Claude / MCP tools to read and change suggestions. `packages/pie-mcp` is still empty.
- Importing Tuki's saved suggestions. Tuki keeps them in its own extension storage, which Pie can't read. They have to be added again (comma lists make this quick).
- A Suggestions slice on the donut.

## How it is built

### Storage

New migration `007_suggestions.sql`:

```sql
CREATE TABLE suggestion_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  collapsed   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE suggestion_values (
  group_id    TEXT NOT NULL REFERENCES suggestion_groups(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  label       TEXT,
  hidden      INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL,
  PRIMARY KEY (group_id, value)
);
```

The on/off switch is a new `suggestionsInChrome` setting, `'on'` or `'off'` (default `'on'`), in the existing settings schema. A word rather than true/false, like `pin`, because the settings table stores text.

### Shared

- `src/shared/schemas/suggestion.schema.ts`: the limits, and zod schemas for a group, a value, and each change message.
- `src/shared/suggestions.ts`: pure helpers, ported from Tuki's `shared/suggestions.js` and typed: splitting a comma list, trimming and one-lining text, and `toChromeList(groups, enabled)`, which keeps only visible values and drops groups left empty. That is the only shape the extension ever sees.

### Main process

- `SuggestionRepository`: groups and values, with `setGroupOrder` and `setValueOrder`.
- `SuggestionService`: `list` and `apply(change)`, where a change adds, renames, removes, reorders, folds or hides a group, or adds, edits, hides, reorders or removes values. Each returns the full list, like `SnippetService`. Moving a value between groups runs in one transaction.
- `suggestions.ipc.ts`: two messages, list and change. A change is a zod union of the change kinds, validated through `handle()`.
- After every change, and every time the extension finishes connecting, the main process sends `setSuggestions` with `toChromeList(...)`. If Chrome isn't connected, it is sent on the next connect, so nothing is queued.

### Pie extension

- `protocol.js`: `setSuggestions` is added to `ACTIONS`.
- `suggestions-store.js`: checks the list's shape and limits, then saves it as `pieSuggestions` in `chrome.storage.local`. Anything malformed is refused, and the old list stays.
- `suggest.js`: the content script, ported from Tuki's `content/suggestions.js`. It reads `pieSuggestions` and follows changes to it. Content scripts can't be modules, so it is one plain script with no imports. It is tested by loading it into jsdom.
- `manifest.json`: adds `content_scripts` for `suggest.js` on `<all_urls>`, all frames, at `document_idle`. No new permissions are needed; `<all_urls>` is already granted. The name becomes "Pie Launcher" and the description mentions both Page Info and suggestions.
- After updating, the extension has to be reloaded once in `chrome://extensions`. Pages already open need a refresh before the dropdown shows on them.

### Settings window

- `SuggestionSection`, `SuggestionGroup` and `SuggestionValueForm` follow the Snippets components.
- `panel.store` gains the suggestion list and actions.
- `SETTINGS_TABS` gains `suggestions` after `snippets`.

### README

A **Suggestions** section, written like the others.

## Testing

Tests are written first with vitest:

- Schema: every limit, blank and line-break handling.
- Shared helpers: comma lists, duplicates skipped, `toChromeList` dropping hidden values and empty groups.
- Service: limits, rename keeping the old name when empty, moving a value with its label and hidden mark, merging into a group that already has it, reorder rejecting a changed list, delete cascading.
- Migration: both tables exist after upgrading a database at version 006.
- IPC: bad input is refused.
- Main process: `setSuggestions` is sent after a change and after the extension connects, and not when disconnected.
- Extension store: a valid list is saved, malformed ones are refused and the old list kept.
- Content script (jsdom): dropdown opens on a trusted click and not on a script click, select matching ("06" picks "06-Jun"), Shift+click selection, fill in order follows page order, Esc closes, skipped input types, turned off hides everything.
- `panel.store`: the suggestion actions.

Needs a manual check in Chrome: the look of the dropdown, iframes, and a React form noticing the filled value.
