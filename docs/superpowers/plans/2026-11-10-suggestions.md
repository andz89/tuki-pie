# Suggestions Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Write each task's tests first, watch them fail, then build.

**Goal:** Saved values in named groups, managed in Settings, offered in a dropdown under fields in Chrome by the Pie extension.

**Architecture:** Two new tables, a repository and a service in the main process, following Snippets. All changes go through one validated message, a zod union of change kinds, so the bridge stays small. A `SuggestionSync` sends the visible list to the extension after each change and on each connect. The extension checks and stores it in `chrome.storage.local`; a plain content script reads it and draws the dropdown.

**Tech Stack:** Electron, React, Zustand, better-sqlite3, zod, vitest, jsdom, Chrome MV3.

**Spec:** `docs/superpowers/specs/2026-11-10-suggestions-design.md`

## Global Constraints

- Up to 50 groups, 200 values per group. Group name up to 40 characters, value up to 200, label up to 40.
- Text is trimmed, and line breaks and tabs become single spaces. Blank names or values keep the old one, or are skipped when adding.
- User-facing errors, verbatim: "You can have 50 groups at most.", "A group can hold 200 values at most.", "That group no longer exists.", "That value no longer exists.", "The suggestions changed. Please try again."
- The extension only ever receives visible values. Hidden values and collapsed state stay in the app.
- Content scripts can't be modules: `suggest.js` has no imports and no exports.
- Do not commit; the repo has no commits and the user hasn't asked.
- Already failing before this work, leave alone: typecheck errors in `PageImages.tsx`, 2 files flagged by `oxfmt --check`.

## Review Focus

- The dropdown must ignore untrusted (script-made) clicks and focus. Test in Task 5.
- A malformed list from the app must leave the stored list unchanged. Test in Task 4.
- Moving a value to a group that already has it merges, and keeps the target's label. Test in Task 1.
- Turning the switch off must hide an open dropdown and clear Shift+click outlines. Test in Task 5.

---

### Task 1: Storage, schema, helpers, service

**Files:**

- Create: `src/main/db/migrations/007_suggestions.sql`, `src/shared/schemas/suggestion.schema.ts`, `src/shared/suggestions.ts`, `src/main/repositories/suggestion.repository.ts`, `src/main/services/suggestion.service.ts`
- Modify: `src/main/db/migrate.ts`, `src/shared/types.ts`, `src/shared/schemas/settings.schema.ts`
- Test: `src/main/db/db.test.ts`, `src/shared/schemas/suggestion.schema.test.ts`, `src/shared/suggestions.test.ts`, `src/main/services/suggestion.service.test.ts`

**Interfaces:**

- Types: `SuggestionValue { value: string; label: string | null; hidden: boolean }`, `SuggestionGroup { id; name; collapsed: boolean; values: SuggestionValue[] }`, `ChromeSuggestions { enabled: boolean; groups: { name: string; values: { value: string; label?: string }[] }[] }`.
- `SuggestionChange`, a zod discriminated union on `kind`: `add-group {name}`, `rename-group {id, name}`, `remove-group {id}`, `reorder-groups {ids}`, `collapse-group {id, collapsed}`, `hide-group {id, hidden}`, `add-values {groupId, text}`, `edit-value {groupId, value, newValue, label, toGroupId}`, `hide-value {groupId, value, hidden}`, `reorder-values {groupId, values}`, `remove-value {groupId, value}`.
- Helpers: `cleanText(text)`, `splitValues(text)`, `toChromeSuggestions(groups, enabled)`.
- `SuggestionService(repository)`: `list()`, `apply(change)` returning the full list, `onChanged(listener)`.
- Setting: `suggestionsInChrome: 'on' | 'off'`, default `'on'`.

- [x] Write the failing tests: migration from version 6 to 7, schema limits, helpers, every change kind in the service, limits and missing-item errors.
- [x] Build until they pass.

### Task 2: IPC, preload, Chrome sync

**Files:**

- Create: `src/main/ipc/suggestions.ipc.ts`, `src/main/chrome-bridge/suggestion-sync.ts`
- Modify: `src/shared/ipc-channels.ts`, `src/shared/types.ts` (`PanelBridge.suggestions`), `src/preload/panel-preload.ts`, `src/main/ipc/settings.ipc.ts`, `src/main/main.ts`, `packages/pie-extension/protocol.js`
- Test: `src/main/ipc/suggestions.ipc.test.ts`, `src/main/chrome-bridge/suggestion-sync.test.ts`

**Interfaces:**

- Channels `panel:suggestions-list` and `panel:suggestions-change`.
- `SuggestionSync({ list, isEnabled, bridge })` with `push()`. `bridge` needs only `status()`, `onStatus()` and `request()`. It pushes on `connected`, and does nothing when not connected. A failed request is ignored, the next connect sends it again.
- `registerSettingsIpc` takes an optional `onChanged` callback so the switch pushes too.

- [x] Write the failing tests: bad input refused, a change pushes when connected, connecting pushes, nothing sent when disconnected.
- [x] Build until they pass, and wire it in `main.ts`.

### Task 3: Settings tab

**Files:**

- Create: `src/renderer/panel/SuggestionSection.tsx`, `src/renderer/panel/SuggestionGroupCard.tsx`, `src/renderer/panel/SuggestionValueForm.tsx`
- Modify: `src/renderer/panel/panel.store.ts`, `src/renderer/panel/settings-tabs.ts`, `src/renderer/panel/SettingsPanel.tsx`, `src/renderer/panel/panel.css`
- Test: `src/renderer/panel/panel.store.test.ts`, `src/renderer/panel/settings-tabs.test.ts`

**Interfaces:**

- Store: `suggestions: SuggestionGroup[]`, `changeSuggestions(change): Promise<boolean>`, `moveSuggestionGroup(id, step)`, `moveSuggestionValue(groupId, value, step)`, and the chrome status for the "not connected" note.

- [x] Write the failing tests: load fetches suggestions, a change applies the answer or shows its error, moves send the swapped order, the tab sits after Snippets.
- [x] Build the components and styles.

### Task 4: Extension store

**Files:**

- Create: `packages/pie-extension/suggestions-store.js`
- Modify: `packages/pie-extension/background.js`, `packages/pie-extension/manifest.json`
- Test: `packages/pie-extension/suggestions-store.test.ts`

**Interfaces:**

- `isSuggestionList(value)`, `createSuggestionStore(storage)` with `save(list)`, which throws on a bad list so the app's request fails.
- Manifest: `content_scripts` for `suggest.js`; name "Pie Launcher".

- [x] Write the failing tests: valid list saved, each limit and shape problem refused with the old list kept.
- [x] Build until they pass.

### Task 5: The dropdown

**Files:**

- Create: `packages/pie-extension/suggest.js`
- Test: `packages/pie-extension/suggest.test.ts` (jsdom)

**Interfaces:**

- When `globalThis.__pieSuggestTest` is set, the script puts `start({ storage, onChanged, isTrusted, shadowMode })` on it instead of starting. A page can't set globals in the extension's world, so this can't be used against it. `start` returns a stop function.

- [x] Write the failing tests: opens on a trusted click and not an untrusted one, lists groups and labels, picking fills and fires input and change, select matching, no list for a select with no match, skipped input types, Shift+click and one value for all, Fill in order follows page order, Esc closes, turning off closes and clears outlines, a changed list is used right away.
- [x] Port Tuki's script until they pass.

### Task 6: Docs and checks

- [x] README **Suggestions** section, and the setup steps mention reloading the extension.
- [x] `npm test`, `npm run typecheck`, `npm run lint`: no new failures.
- [ ] Manual check in Chrome, listed for the user.
