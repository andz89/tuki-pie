# Deep review: findings

Date: 2026-11-11. Scope: the whole repo (about 38,000 lines), reviewed read-only in five parts. No code was changed.

Goal of the review: find bugs and future bugs, make the app faster, check the architecture, and check that it is hard to attack and safe for users.

## Baseline

- Typecheck: clean.
- Tests: 1205 passed in 97 files.
- `npm audit --omit=dev`: 0 known vulnerabilities.
- Lint: one formatting failure in `vite.renderer.config.mts`.

## Verdict

No Critical finding in any part. No way was found for a website, or a page checked in Page Info, to run code in the app or connect to the Chrome bridge. The base is strong: sandboxed and isolated windows, zod on every IPC channel, opens by id with an allow list, parameterized SQL, safe migrations, a paired and origin-checked WebSocket, good fuses.

What needs work: a handful of real bugs that lose data or kill the app, a missing second layer of defence, Page Info resetting and slowing down on large or hostile pages, and extension reliability during captures.

"Checked" below means the code was read again after the reviewer's report and matches. "Reported" means only the reviewer read it.

## A. Bugs that break things for the user

| # | Finding | Where | Status |
|---|---|---|---|
| A1 | Reordering apps does nothing once there are more than 8 apps. The IPC check caps the list at 8, the apps row allows 18. | `src/main/ipc/shortcuts.ipc.ts:72`, `src/shared/schemas/shortcut.schema.ts:5` | Checked |
| A2 | A failure during startup (corrupt db, native module mismatch, failed migration) leaves an invisible process that holds the single-instance lock. No error is shown. | `src/main/main.ts:105` | Checked |
| A3 | One stored setting that no longer validates makes `settings.get()` throw, which blocks startup (leads into A2). | `src/main/services/settings.service.ts:12` | Checked |
| A4 | The donut window has no close handler. Alt+F4 on it quits the app silently, or leaves a destroyed window that throws on every hotkey. A renderer crash is not recovered either. | `src/main/windows/pie-window.ts:42-84`, `src/main/main.ts:101` | Missing handler checked, behaviour not run |
| A5 | Esc in the zip name box closes the whole donut. The hint says it goes back. | `src/renderer/components/ZipNameBox.tsx:14-22`, `src/renderer/hooks/usePieKeyboard.ts:66-70` | Checked |
| A6 | Enter and arrow keys are taken from focused buttons in the list cards, so Enter opens Settings, not the shortcut or snippet. | `src/renderer/hooks/usePieKeyboard.ts:37-70` | Checked |
| A7 | Notes: text typed in the last 500 ms before closing the window may not be saved. A brand new note can be lost whole. | `src/renderer/notes/NotesWindow.tsx:140-148`, `src/renderer/notes/note-saver.ts:29-32` | Reported, timing dependent |
| A8 | Page Info: when a capture fails because the page changed, the previous page's screenshot comes back and Save then fails. | `src/renderer/page-info/page-info.store.ts:137-151` | Checked |
| A9 | Pinned donut: reopening at the cursor while a list card is open leaves the card clipped. Main resets the window, the renderer does not. | `src/main/windows/pie-window.ts:104-105`, `src/renderer/stores/pie.store.ts:76-82, 200-209` | Reported |
| A10 | A throw inside the reminder timer stops all reminders until a note changes. | `src/main/notes/reminder-scheduler.ts:34-46` | Reported |
| A11 | App icons on the donut are cached per id for the whole session, including failures. An edited shortcut keeps its old icon. | `src/renderer/stores/pie.store.ts:225-235` | Reported |
| A12 | "Chrome not connected." stays on screen after Chrome reconnects. | `src/main/page-info/page-info-controller.ts:225-233` | Reported |
| A13 | Leftover debug code writes capture details to a temp file on every screenshot. Marked TEMPORARY. | `src/main/chrome-bridge/chrome-site.ts:30-50`, `packages/pie-extension/capture.js:448-463` | Checked |

Smaller ones: remove and renumber are separate writes (a crash between them can break later adds on slices); two zips with the same name in flight overwrite each other; a folder named like a picture fails the whole zip; `.jfif` and `.jpe` are not counted as pictures; a repeating reminder set between 02:00 and 03:00 drifts after a spring clock change; a db from a newer app version is opened with no check; reminder card hides a reminder even when the action failed; settings panel focus clears the error message; forms can be submitted twice; section picker can get stuck after losing pointer capture; an unhandled rejection in `page-info-window.ts:104-119`.

## B. Security and user safety

| # | Finding | Where | Status |
|---|---|---|---|
| B1 | IPC handlers never check which window is calling. The rule "only the settings window can change things" lives only in the preloads. No exploit path exists today, but any future script injection in one window would reach every channel, including adding and opening a shortcut to a remote program. | `src/main/ipc/handle.ts:13-16`, raw handlers in `window.ipc.ts`, `volume.ipc.ts` | Checked |
| B2 | No Content-Security-Policy on any window. | all `src/renderer/*.html` | Reported by two reviewers |
| B3 | Page Info loads images from the checked page directly in the app window. A hostile page learns the user's IP and can aim requests at localhost or the local network. Images that need Chrome's cookies show as "Broken". | `src/renderer/page-info/page-info-view.ts:5-11`, `PageDashboard.tsx`, `PageImages.tsx`, `SocialCard.tsx` | Reported |
| B4 | The suggestions list in Chrome can be clickjacked. A hostile page can make the list invisible but still clickable and trick the user into picking a saved value into the page's own field. | `packages/pie-extension/suggest.js:53-57, 186-199` | Host style checked, attack not run |
| B5 | The suggestions list is offered on password fields. | `packages/pie-extension/suggest.js:17-28` | Checked |
| B6 | "Reload as device" reloads the user's own tab, and the 30 s timeout calls `window.stop()` in it. Both break the stated rule that a user's tab is never reloaded or cleared. Unsaved form input can be lost. | `packages/pie-extension/tabs.js:124-137, 196-208` | Checked |
| B7 | `reg.exe` and `powershell.exe` are started by bare name. If the working directory is a folder with a planted file of that name, it could run. Whether the installed app's working directory can be such a folder was not verified. | `src/main/shell-menu/shell-menu.ts:42, 57`, `src/main/shortcuts/shell-icon.ts:61`, `src/main/zip/explorer-selection.ts:117` | Reported, plausible |
| B8 | A hostile page can stall the main process in tracker detection. Measured: the Microsoft Ads pattern takes about 0.5 s per MB of crafted script text, the transport allows 32 MB per read, and each check reads three times. | `src/shared/page-audit.ts:302`, `src/main/page-info/page-report.ts:41` | Measured |
| B9 | Slice paths are barely validated (no absolute check, no length cap) and the denylist of program file types for notes is incomplete. | `src/shared/schemas/slice.schema.ts:12`, `src/main/services/slice.service.ts:22-23` | Reported |
| B10 | The pairing code is stored as plain text in the app db and in Chrome storage. Anyone holding it can read and screenshot any site in the user's logged-in Chrome. This is inherent to the design and comparable to what same-user malware can already do, so it is hardening. | `src/main/chrome-bridge/pairing-code.ts:20-24`, `packages/pie-extension/popup.js:48` | Reported |
| B11 | A copied address is auto-checked in logged-in Chrome without the link safety rules that the Links list applies. | `src/main/windows/page-info-window.ts:79-91` | Reported |
| B12 | Link filters miss camelCase words (`/deleteAccount`), hash routes, and unparseable links. | `src/shared/link-rules.ts:118-193` | Reported |

Smaller ones: the donut bridge can update any setting, contrary to its comment; the default session has no deny-all permission handler; the in-app browser profile is persistent with no way to clear it; unused `slices` API is exposed in two preloads; native modules use caret ranges.

## C. Speed

| # | Finding | Where | Status |
|---|---|---|---|
| C1 | Page Info: every resend from main gives the renderer a new report object, which clears link ticks, statuses and the image viewer and replays the dashboard. Main reads each page three times, so this happens twice within 5 s of load. | `src/main/page-info/page-info-controller.ts:340-382`, `PageInfoWindow.tsx:126-129`, `PageLinks.tsx:165-169`, `PageImages.tsx:223-228` | Reported |
| C2 | Page Info: in-place URL changes (hash, history) trigger a full re-read at once, with no debounce. | `src/main/page-info/page-info-controller.ts:259-268` | Reported |
| C3 | Page Info: up to 100 MB of inline scripts can be collected per read and sent three times, only to be regex-matched in main. Pages over 32 MB fail outright. | `packages/pie-extension/collect-page.js:8-9, 161-163` | Caps checked |
| C4 | Page Info: up to 5,000 links and 5,000 images render with no virtualization or memoization. Each keystroke in the address or highlight box re-renders every row. | `PageInfoWindow.tsx`, `PageLinks.tsx`, `PageImages.tsx`, `src/shared/link-rules.ts:140-174` | Reported |
| C5 | Extension: requests run strictly one at a time. A 50 to 90 s capture blocks everything, the app times out after 10 s, and the stale requests still run later. | `packages/pie-extension/connection.js:100, 134-144` | Reported |
| C6 | Notes: the sidebar reprocesses every note's full text on each keystroke, and each autosave reloads the whole list over IPC. | `src/renderer/notes/NotesWindow.tsx:189, 228-254` | Reported |
| C7 | Every donut open over Explorer starts a PowerShell to read the selection, even if Zip is never used. Store-app icons each start their own PowerShell with no queue or disk cache. | `src/main/zip/zip-selection.ts:29-37`, `src/main/shortcuts/shell-icon.ts` | Reported |
| C8 | Each note save runs two full reminder scans that load note bodies. | `src/main/services/note.service.ts:100-131` | Reported |
| C9 | A pinned donut animates continuously while idle. | `src/renderer/styles/pie.css:343-410` | Reported, cost not measured |
| C10 | Screenshots: full-screen PNG encodes block the main thread; a full-page capture of up to 32 MB sits in main, crosses IPC and feeds three images. | `src/main/screenshot/screenshot.ts:73-84`, `src/main/ipc/page-info.ipc.ts:79-113` | Reported |
| C11 | Extension stitch fallback holds up to 80 full frames in memory and leaks them on error. Debugger capture has no height cap. Cleanup after a hung page can take over 60 s. | `packages/pie-extension/capture.js:311-442` | Reported |

Smaller ones: accent colour saves on every drag step; wheel and drag steps are one IPC call each; state reset happens on focus, after the window shows; vitest reports the suite could run about 9.5 s faster with `isolate: false` (not checked for safety).

## D. Architecture

1. Layering (ipc, service, repository) is clean and well tested. Exceptions: `shortcuts.ipc.ts` and `settings.ipc.ts` hold logic that belongs in a service.
2. `main.ts` is a growing composition root with ordering rules that live in comments. Splitting it into build services, register IPC, start runtime gives A2 one place for error handling.
3. Limits are duplicated as literals between IPC checks and shared schemas. A1 is this drift already happening.
4. `collect-page.js` exists twice, kept identical by a test. Only the extension copy runs. `show-link.js` re-implements two of its functions by hand with nothing tying them together.
5. `pie.store.ts` mixes data, hover interaction and window commands. `NotesWindow.tsx` and `PageInfoWindow.tsx` are the two components worth splitting.
6. The donut's lifecycle is driven by the DOM focus event although main already sends opening and closing phases. A9 and the stale-state flash both come from that.
7. `allowed_apps` only grows. Entries are never removed when the shortcut goes.
8. "Show site" is unreachable in the UI, but its window, IPC channel, state and session setup remain, and the README still describes it.

## Open decisions for the owner

1. Updates and signing. There is no update channel and builds are unsigned, while the app embeds a browser pinned to Electron 45.2.3. Add an update feed and signing, or accept manual reinstalls.
2. "Show site". Delete the viewer path, or restore the button. The README needs a fix either way.
3. Page Info images (B3). Keep loading them in the app window behind a CSP, or have the extension fetch thumbnails in Chrome.
4. In-app browser profile. Keep it persistent, make it in-memory, or add a clear button.

## Not covered

CSS files (only searched for costly effects), most test files, `src/main/tray`, `src/shared/types.ts` drift between main and renderer, and `package-lock.json`.
