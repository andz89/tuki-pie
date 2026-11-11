# Shortcuts Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a built-in Shortcuts slice whose fan opens links and apps, holds one level of groups, and offers add circles.

**Architecture:** A new `shortcuts` table with its own repository and service, separate from slices. The donut reuses a fan component shared with Settings. Add circles ask the main process to open the settings window with a form request, which the window picks up.

**Tech Stack:** Electron 45, React, zustand, zod, better-sqlite3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-shortcuts-design.md`

## Global Constraints

- Up to 8 shortcuts and groups per row, at the top level and inside each group. Add and Back circles do not count.
- Labels are 1 to 24 characters. Link targets are at most 2048 characters.
- Links must use `http` or `https`, checked on save and on every open.
- Groups hold shortcuts only. No group inside a group.
- A group opens after about 180 ms of hover. Back works by click.
- Do not commit. The user has not asked for commits on this project, so skip any commit step.
- After each task: `npx vitest run`, `npx tsc --noEmit` and `npm run lint` all pass. Run `npx oxfmt` on changed files if lint reports formatting.
- Drive the real app only with its own `--user-data-dir`, and with `ELECTRON_RUN_AS_NODE` removed.

## Review Focus

1. A stored link changed to `file:` or `javascript:` must be refused at open, not only at save. Test in Task 2.
2. `localhost:3000` and `example.com` must become valid links, while `javascript:alert(1)` must stay refused. Test in Task 1.
3. A group removed in Settings while a pinned donut shows it must fall back to the top level, not crash. Test in Task 5.
4. Moving the mouse off a group before the delay must not open it. Test in Task 5.
5. A name starting with an emoji or spaces must show one whole character. Test in Task 5.

---

### Task 1: Shortcut schema, migration and repository

**Files:**

- Create: `src/shared/schemas/shortcut.schema.ts`, `src/shared/schemas/shortcut.schema.test.ts`, `src/main/db/migrations/002_shortcuts.sql`, `src/main/repositories/shortcut.repository.ts`
- Modify: `src/main/db/migrate.ts` (add to `MIGRATIONS`), `src/main/db/db.test.ts:48` (version 2), `src/main/repositories/repositories.test.ts`, `src/shared/types.ts` (re-export types)

**Interfaces:**

- Produces, from the schema file: `MAX_SHORTCUTS_PER_ROW = 8`; `isWebLink(value: string): boolean`; `normalizeWebAddress(value: string): string`; zod `Shortcut` `{ id, label, type: 'link'|'app'|'group', target: string|null, parentId: string|null, position }`; zod `NewShortcut`, a discriminated union on `type`: link `{ label, target, parentId }`, app `{ label, target, parentId }`, group `{ label, target: null, parentId: null }`; zod `ShortcutEdit` `{ id, label, target: string|null }`; zod `PanelFormRequest`, a discriminated union on `kind`: `{ kind: 'shortcut', parentId: string|null }`, `{ kind: 'group' }`, `{ kind: 'section' }`.
- Produces: `class ShortcutRepository(db)` with `findAll(): Shortcut[]` (by parent, then position), `findById(id)`, `countIn(parentId: string|null): number`, `insert(shortcut: Shortcut)`, `update(edit: ShortcutEdit)`, `remove(id)`, `setOrder(ids: string[])`, `findAppByTarget(path): Shortcut|undefined`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(['https://a.com', 'http://a.com/x?y=1'])('accepts %s', (v) =>
  expect(isWebLink(v)).toBe(true),
);
it.each([
  'file:///C:/a',
  'javascript:alert(1)',
  'https://',
  'ftp://a.com',
  'a b',
])('refuses %s', (v) => expect(isWebLink(v)).toBe(false));
expect(normalizeWebAddress(' example.com ')).toBe('https://example.com');
expect(normalizeWebAddress('localhost:3000')).toBe('https://localhost:3000');
expect(normalizeWebAddress('http://a.com')).toBe('http://a.com');
expect(isWebLink(normalizeWebAddress('javascript:alert(1)'))).toBe(false);
expect(
  NewShortcut.safeParse({
    label: 'G',
    type: 'group',
    target: null,
    parentId: 'x',
  }).success,
).toBe(false);
expect(
  NewShortcut.safeParse({
    label: 'L',
    type: 'link',
    target: 'file:///a',
    parentId: null,
  }).success,
).toBe(false);
```

Repository tests, on a real in-memory database: `countIn(null)` and `countIn('g')` count separately; removing a group removes its children; `findAll` returns position order; `findAppByTarget` finds an app inside a group and ignores a link with the same text.

Database test: a file at `user_version` 1 with a slice migrates to 2, keeps the slice, and `openDatabase(...).isNew` is false.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/shared/schemas/shortcut.schema.test.ts src/main/repositories src/main/db`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement**

The SQL is in the spec. In `normalizeWebAddress`, trim, then add `https://` unless the text has a scheme. A scheme is `/^[a-z][a-z0-9+.-]*:(?!\d)/i`, so `host:port` is not one. `isWebLink` uses `new URL` in a try, requires protocol `http:` or `https:`, and a non-empty `hostname`. Map `parent_id` to `parentId` with a zod row parse, as `SettingsRepository` does.

- [ ] **Step 4: Run and confirm pass**

Run the command from Step 2. Expected: PASS.

### Task 2: ShortcutService and the allowed-apps guard

**Files:**

- Create: `src/main/services/shortcut.service.ts`, `src/main/services/shortcut.service.test.ts`
- Modify: `src/main/services/slice.service.ts`, `src/main/services/services.test.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces: `class ShortcutService(shortcuts, allowedApps, kindOf: (p)=>PathKind, openPath: (p)=>Promise<string>, openExternal: (url)=>Promise<void>)` with `list()`, `open(id): Promise<void>`, `add(item: NewShortcut): Shortcut[]`, `update(edit): Shortcut[]`, `remove(id): Shortcut[]`, `reorder(parentId: string|null, ids: string[]): Shortcut[]`.
- Produces: `SliceService` gains a fifth constructor argument, `findShortcutUsingApp: (path: string) => string | undefined = () => undefined`, returning the shortcut's label.

- [ ] **Step 1: Write the failing tests**

Use a real in-memory database and fake `kindOf`, `openPath` and `openExternal`. Each row is one test:

| Action                                                 | Result                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| open a link                                            | `openExternal` called once with the link                                      |
| open a stored link set to `file:///C:/a` by direct SQL | `UserError` 'Links must start with http or https.', `openExternal` not called |
| open an app not on the allowed list                    | 'App not allowed. Check Settings.', `openPath` not called                     |
| open an allowed app whose file is gone                 | 'App not found. Fix it in Settings.'                                          |
| `openExternal` rejects                                 | `Could not open ${label}.`                                                    |
| open a group                                           | 'That shortcut cannot be opened.'                                             |
| open an unknown id                                     | 'That shortcut no longer exists.'                                             |
| add a 9th item to a row                                | 'This row can hold 8 shortcuts at most.'                                      |
| 8 items at top level, add into a group                 | succeeds                                                                      |
| add with `parentId` of a link, or an unknown id        | 'That group no longer exists.'                                                |
| update a link to a bad target                          | refused, the old target kept                                                  |
| update a group with a non-null target                  | 'A group has no address.'                                                     |
| remove from the middle of a row                        | remaining positions are 0, 1, ...                                             |
| `reorder` with ids not exactly matching the row        | 'The shortcuts changed. Please try again.'                                    |

In `services.test.ts`: `removeAllowedApp` throws `${label} still uses this app. Remove that shortcut first.` when `findShortcutUsingApp` returns a label.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/main/services`
Expected: FAIL.

- [ ] **Step 3: Implement**

Follow `SliceService`. Check the link rule inside `open` for every open.

- [ ] **Step 4: Run and confirm pass**

Run the command from Step 2. Expected: PASS.

### Task 3: Messages, bridges and the form request

**Files:**

- Create: `src/main/ipc/shortcuts.ipc.ts`, `src/main/ipc/shortcuts.ipc.test.ts`
- Modify: `src/shared/ipc-channels.ts`, `src/shared/types.ts`, `src/preload/preload.ts`, the panel preload, `src/main/ipc/window.ipc.ts`, `src/main/windows/panel-window.ts`, `src/main/main.ts`

**Interfaces:**

- Consumes: Tasks 1 and 2.
- Produces channels: `shortcutsList`, `shortcutsOpen`, `panelShortcutAdd`, `panelShortcutUpdate`, `panelShortcutRemove`, `panelShortcutsReorder`, `windowOpenShortcutForm`, `panelTakeFormRequest`, `panelFormRequested`.
- Produces on `PieBridge`: `shortcuts: { list(): Promise<Result<Shortcut[]>>; open(id: string): Promise<Result> }` and `window.openShortcutForm(request: PanelFormRequest): Promise<void>`.
- Produces on `PanelBridge`: `shortcuts: { list, add(item), update(edit), remove(id), reorder(parentId, ids) }`, each `Promise<Result<Shortcut[]>>`; `takeFormRequest(): Promise<Result<PanelFormRequest | null>>`; `onFormRequested(listener: () => void): () => void`.
- Produces in `panel-window.ts`: `requestPanelForm(request: PanelFormRequest): void`, `takePanelFormRequest(): PanelFormRequest | null`.

- [ ] **Step 1: Write the failing tests**

Follow `panel.ipc.test.ts`. Assert: adding an app calls `slices.allowApp(path)` before `shortcuts.add`; adding a link does not; a `file:` link is rejected with no save; `shortcutsOpen` passes only the id. For `window:open-shortcut-form`: `dismissPieWindow` and `requestPanelForm` each run once with the request, and `{ kind: 'nope' }` throws with neither called. For the panel window: `takePanelFormRequest` returns the request once, then `null`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/main/ipc`
Expected: FAIL.

- [ ] **Step 3: Implement**

Use `handle` with zod tuples. `requestPanelForm` stores the request, calls `openPanelWindow`, and sends `panelFormRequested` if the window already existed. In `main.ts`, build the shortcut repository first, pass `(path) => repo.findAppByTarget(path)?.label` to `SliceService`, and pass `(url) => shell.openExternal(url)` to `ShortcutService`.

- [ ] **Step 4: Run and confirm pass**

Run the command from Step 2. Expected: PASS.

### Task 4: Two built-in slices and a shared fan

**Files:**

- Create: `src/renderer/components/PieFanRow.tsx`
- Modify: `src/renderer/components/PieSettingsFan.tsx`, `PieMenu.tsx`, `PieCenter.tsx`, `slice-display.ts`, `icons/SliceIcon.tsx`, `src/renderer/hooks/usePieKeyboard.ts`, `usePieKeyboard.test.ts`, `src/renderer/stores/pie.store.ts`

**Interfaces:**

- Produces: `PieFanRow({ middle, circles }: { middle: number; circles: FanCircle[] })`, where `FanCircle = { id, icon?: PieIconName, letter?: string, label, value, onClick, onWheel?, onEnter?: () => void, onLeave?: () => void }`.
- Produces: `SHORTCUTS_ITEM = { label: 'Shortcuts', description: 'Links and apps' }`; icons `'shortcut'`, `'add'`, `'add-group'`, `'group'`, `'back'`; store action `openShortcutForm(request: PanelFormRequest): void`.
- Index rule: Shortcuts is at `slices.length`, Settings at `slices.length + 1`, ring count `slices.length + 2`.

- [ ] **Step 1: Update the keyboard tests to fail**

With 8 slices: Enter at index 8 calls `bridge.window.openShortcutForm({ kind: 'section' })`; Enter at index 9 calls `openSettings`; ArrowRight from 9 goes to 0.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/renderer/hooks`
Expected: FAIL.

- [ ] **Step 3: Implement**

Move the band, circles, active state, click tilt and hint effects from `PieSettingsFan` into `PieFanRow` unchanged, except that the circle count comes from `circles.length`. `PieSettingsFan` builds its six circles and passes them. Its `cycleSize` keeps using `fanAngles(middle, 6)[3]`, and it receives its slice index as a prop for `setHovered`. Add the Shortcuts `PieSlice` before Settings in `PieMenu`, with `showsShortcutsFan`, rendering nothing inside until Task 5.

- [ ] **Step 4: Run and confirm pass, and that Settings looks the same**

Run: `npx vitest run`
Expected: PASS. Then compare the Settings fan with a screenshot from the real app.

### Task 5: The Shortcuts fan in the donut

**Files:**

- Create: `src/renderer/components/PieShortcutsFan.tsx`, `src/renderer/components/shortcut-row.ts`, `shortcut-row.test.ts`, `src/renderer/hooks/hover-intent.ts`, `hover-intent.test.ts`
- Modify: `src/renderer/components/PieSlice.tsx`, `src/renderer/stores/pie.store.ts`, `pie.store.test.ts`

**Interfaces:**

- Consumes: Tasks 3 and 4.
- Produces: `GROUP_HOVER_MS = 180`; `shortcutRow(all: Shortcut[], openGroupId: string|null): { groupId: string|null; items: Shortcut[] }`; `firstLetter(label: string): string`; `createHoverIntent(delayMs: number, onFire: (id: string) => void): { enter(id: string): void; leave(): void }`; store state `shortcuts: Shortcut[]`, action `openShortcut(id: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(firstLetter('mail')).toBe('M');
expect(firstLetter('  news')).toBe('N');
expect(firstLetter('😀 Fun')).toBe('😀');
expect(shortcutRow([top, group, inner], null).items).toEqual([top, group]);
expect(shortcutRow([top, group, inner], 'g').items).toEqual([inner]);
expect(shortcutRow([top], 'gone')).toEqual({ groupId: null, items: [top] });
```

With fake timers: `enter('g')` fires after 180 ms; `enter('g')` then `leave()` at 100 ms never fires; `enter('a')` then `enter('b')` fires only `'b'`.

Store: `openShortcut` success calls `bridge.window.dismiss` once. Failure sets `error` and does not dismiss. `load` also fills `shortcuts`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/renderer`
Expected: FAIL.

- [ ] **Step 3: Implement `PieShortcutsFan({ middle }: { middle: number })`**

Local state is `openGroupId`. Build circles from `shortcutRow`. Shortcuts use `letter` and values `Link` or `App`; groups use icon `'group'`, value `Group`, and hover intent through `onEnter` and `onLeave`. Top level ends with Add shortcut (`{ kind: 'shortcut', parentId: null }`) and Add group (`{ kind: 'group' }`). Inside a group, end with Add shortcut (`{ kind: 'shortcut', parentId: groupId }`) and Back. Give `PieFanRow` `key={groupId ?? 'top'}` so the pop-out replays on a swap. Cancel the hover intent on unmount.

- [ ] **Step 4: Run and confirm pass**

Run the command from Step 2. Expected: PASS.

### Task 6: The Shortcuts part of the Settings window

**Files:**

- Create: `src/renderer/panel/ShortcutSection.tsx`, `src/renderer/panel/ShortcutForm.tsx`
- Modify: `src/renderer/panel/SettingsPanel.tsx`, `panel.store.ts`, `panel.store.test.ts`, `panel.css` only if needed

**Interfaces:**

- Consumes: Task 3.
- Produces store state `shortcuts: Shortcut[]`, `formRequest: PanelFormRequest | null`; actions `addShortcut`, `updateShortcut`, `removeShortcut`, `reorderShortcuts`, `pickUpFormRequest(): Promise<void>`, `clearFormRequest()`.

- [ ] **Step 1: Write the failing store tests**

`pickUpFormRequest` stores what `takeFormRequest` returns. A refused `addShortcut` returns `false`, sets `error` and keeps the list. `load` fills `shortcuts`.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/renderer/panel`
Expected: FAIL.

- [ ] **Step 3: Implement**

Follow `SliceSection` and `SliceForm`. List groups with their shortcuts indented, with up and down buttons inside each row. The form has Name, a Link or App choice, and either a web address box or the Browse button using `pickPath('app')`. Pass link text through `normalizeWebAddress` before saving. Type cannot change when editing. Removing a group with shortcuts inside asks first: `Remove ${label} and the ${n} shortcuts inside it?`. `SettingsPanel` calls `pickUpFormRequest` on mount, on focus and on `onFormRequested`. A request opens the matching form, or scrolls to the section for `{ kind: 'section' }`.

- [ ] **Step 4: Run and confirm pass**

Run the command from Step 2. Expected: PASS.

### Task 7: Check it in the real app

**Files:** none in the project. Keep the driver in the scratch folder.

- [ ] **Step 1: Drive a separate copy with Playwright `_electron`**

Replace `shell.openPath` and `shell.openExternal` with recorders so nothing opens on the desktop. Seed through the panel bridge: one link, one app, one group with a link inside. Check each of these:

- Hovering Shortcuts shows the circles, then Add shortcut and Add group.
- A quick pass over the group does not swap the row. Resting on it for 300 ms does.
- Back returns to the top level.
- Clicking a link records its address.
- Add shortcut inside the group opens the form with that group set.
- The Settings fan still works and the pin checks still pass.

Pick the donut window by URL, because a first run opens both windows.

- [ ] **Step 2: Look at screenshots**

Top-level row, a full row of 10 circles, and the inside of a group. Expected: no circle clipped by the window, and letters readable in both themes.

- [ ] **Step 3: Run all project checks**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`
Expected: all pass.
