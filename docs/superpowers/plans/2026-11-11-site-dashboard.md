# Site Dashboard Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Write each task's tests first, watch them fail, then build.

**Goal:** A Dashboard tab, first in the Web Page window, showing the whole report as tiles that open the detailed tabs.

**Architecture:** Pure helpers in `page-dashboard.ts` compute every number; `PageDashboard.tsx` only lays them out. No main-process or IPC change: everything comes from the existing `PageReport` and screenshot state.

**Tech Stack:** React, Zustand, CSS, vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-site-dashboard-design.md`

## Global Constraints

- Page data is untrusted: images only through `shareImageSource`, with `referrerPolicy="no-referrer"`.
- Works in dark and light themes and with any accent.
- Every animation is off under `prefers-reduced-motion: reduce`.
- Do not commit; the user hasn't asked.
- Already failing before this work, leave alone: `oxfmt --check` on `vite.renderer.config.mts`; one flaky test.

### Task 1: Helpers

**Files:** Create `src/renderer/page-info/page-dashboard.ts`, test `src/renderer/page-info/page-dashboard.test.ts`

- [x] Write the failing tests.
- [x] Build until they pass.

### Task 2: Dashboard tab

**Files:** Create `src/renderer/page-info/PageDashboard.tsx`, `src/renderer/page-info/use-count-up.ts`. Modify `PageInfoWindow.tsx`, `page-info.css`.

- [x] Tiles as in the spec, wired to `onOpen(tab)`.
- [x] Dashboard first and default in `TABS`.
- [x] Styles, motion, reduced motion.
- [x] `npm test`, `npm run typecheck`, `npm run lint` pass (apart from the known issues).
