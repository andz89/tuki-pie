# Deep review: fix plan

Findings: `docs/superpowers/specs/2026-11-11-deep-review-design.md`. Ids (A1, B3, C5) refer to that file.

Rules for every batch: write the failing test first, make it pass, then run `npm run typecheck`, `npm run lint` and `npm test`. One commit per task. A first commit of the current state comes before batch 1, so each fix can be compared and rolled back.

Batches are ordered by value for effort. Each stands alone, so they can be done in any order or skipped.

## Batch 1: bugs that break things (small, low risk)

| Task | Fix | Test |
|---|---|---|
| A1 | Take the reorder and move limits from `MAX_SHORTCUTS_PER_ROW` and `MAX_APPS`, not literals. | Reorder 9 apps through the IPC layer. |
| A2 | Wrap the `whenReady` body in try/catch: show `dialog.showErrorBox`, then `app.exit(1)`. Register `will-quit` cleanup first. Refuse a db whose `user_version` is newer than the known migrations. | Startup with a throwing db; newer `user_version`. |
| A3 | Validate settings per key with `safeParse`, fall back to the default for a failing key. | One invalid stored value still loads. |
| A4 | Pie window: on `close`, hide unless quitting; on `closed`, clear and recreate lazily; reload on `render-process-gone`. | Close event is prevented; hotkey after destroy recreates. |
| A5, A6 | Key handler ignores events from inputs, buttons and the list card; zip box stops Esc and Enter from bubbling. | Esc in zip box keeps the donut open; Enter on a focused list button is not taken. |
| A8 | Build the failure state from the store after the await. | Page changes mid-capture, old picture does not return. |
| A10 | try/catch in the scheduler body, always re-arm in `finally`. | Throwing source still re-arms. |
| A12 | Clear the `CHROME_OFF` message on reconnect. | Controller test. |
| A13 | Remove the temporary capture notes on both sides. | Existing tests updated. |
| Lint | `npm run lint:fix` for `vite.renderer.config.mts`. | Lint passes. |

## Batch 2: data safety

| Task | Fix | Test |
|---|---|---|
| A7 | Main owns the Notes close: prevent once, ask the renderer to flush, wait for the ack with a short timeout, then destroy. Same on quit. | Close within the debounce window still saves. |
| A9 | Reset and resync the donut on the `closing` and `opening` phase messages, not on focus. | Store test for pinned reopen. |
| A11 | Key the icon cache by id plus target; do not cache failures. | Edited target loads a new icon. |
| Positions | Remove plus renumber in one transaction for slices, shortcuts and snippets. | Repository tests. |
| Zip | Reserve the target name with an exclusive create; filter with `isFile()`; add `.jfif`, `.jpe`. | Two zips with one name; folder in the selection. |
| Small | Reminder card rollback, panel error kept on focus, form in-flight guard, picker pointer cancel, unhandled rejection in `page-info-window.ts`. | One test each. |

## Batch 3: security hardening

| Task | Fix | Test |
|---|---|---|
| B1 | `handle()` takes the event and an allowed-window set per channel; rejects any sender that is not the main frame of that window. Route `window.ipc.ts` and `volume.ipc.ts` through it. Remove the unused `slices` bridge. Narrow the donut's settings bridge to the pin setting. | Call a panel channel from another window's sender. |
| B2 | Build-time CSP meta in every renderer HTML file, looser variant in dev. Deny-all permission handlers on the default session. | Test that each built HTML carries the policy. |
| B4, B5 | Suggestions host styles with `!important`; before a pick, check the host is visible and is the element at the click point; ignore picks for 300 ms after the list opens or moves. Skip password, one-time-code and card fields. | jsdom tests for each skip and the delay. |
| B6 | Reload and `window.stop()` only when the checked tab is the extension's own tab. | `tabs.test.ts`. |
| B7 | Absolute paths under `%SystemRoot%\System32` for `reg.exe` and `powershell.exe`. | Unit test on the path builder. |
| B9 | Slice path: absolute, max length; notes by an allowlist of document types. | Schema tests. |
| B11, B12 | Apply the link rules to the clipboard address; split camelCase, include hash segments, treat unparseable links as blocked. | `link-rules.test.ts`. |
| B10 | Store the pairing code with Electron `safeStorage`. | Service test with a fake. |

B3 (remote images) depends on the owner's decision in the findings file.

## Batch 4: Page Info speed and stability

| Task | Fix | Test |
|---|---|---|
| C1 | Main skips the send when the report is unchanged and attaches a report id; the renderer keys its resets on that id. | Controller test: three equal reads send once. |
| C2 | Debounce in-place changes by 500 ms; forget the capture only when path or query changes. | Controller test with fake timers. |
| B8, C3 | Detect trackers in `collect-page.js` and send only the matches. This removes the large payload and the regex cost in main. | Collector tests; payload size test. |
| C4 | Memoize derived lists, memo the rows with stable callbacks, move the address and highlight inputs into their own component, virtualize both lists. | Existing tests plus a render count test. |
| Counts | H1 count from the full list; one source for the dashboard link numbers. | `page-dashboard.test.ts`. |
| C10 | One blob URL for the screenshot, a small thumbnail from main for the dashboard. | Store test. |
| Audit | Hreflang check ignores tracking query keys; H1 with an image uses its alt. | `page-audit.test.ts`. |

## Batch 5: extension reliability

| Task | Fix | Test |
|---|---|---|
| C5 | Run requests concurrently after the handshake, with a mutex only for capture; drop requests past their deadline. | `connection.test.ts`. |
| C11 | Stitch: draw and close each frame at once, close leftovers in `finally`, size the canvas to what was captured. Cap debugger capture height. On timeout, detach first. | `capture.test.ts`. |
| Small | Slow retry from `bad-code`; fix the lost update in `tabs.js` `save()`; `minimum_chrome_version` 120; a test tying `show-link.js` to `collect-page.js`. | One test each. |

## Batch 6: app speed

| Task | Fix |
|---|---|
| C6 | Memoized notes sidebar, preview from the first few hundred characters, patch one note after a save. |
| C7 | Read the Explorer selection lazily or reuse one in-flight read; queue shell icon reads and cache them on disk. |
| C8 | Narrow query for the reminder scheduler; skip the refresh when only text changed. |
| C9 | Pause the orbit when the pinned donut is not focused. |
| Small | Debounce the accent colour; coalesce wheel and drag IPC; JPEG for the section picker. |

## Batch 7: architecture

Split `main.ts` into build services, register IPC and start runtime. Move logic from `shortcuts.ipc.ts` and `settings.ipc.ts` into services. Split `pie.store.ts`, `NotesWindow.tsx` and `PageInfoWindow.tsx` along the seams named in the findings. Keep one `collect-page.js`. Clean `allowed_apps` on remove. No behaviour change, so the existing tests are the check.

## Waiting on the owner

Updates and signing, "Show site", Page Info images, in-app browser profile. See "Open decisions" in the findings file.
