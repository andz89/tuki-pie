# Chrome history: plan

Spec: `docs/superpowers/specs/2026-11-15-chrome-history-design.md`

1. **Extension**: `history.js` with `createHistorySearch(chrome)`, `history` in `ACTIONS`, wired in `background.js`, `history` permission, version 1.2.0. Test alongside.
2. **Main**: `pageInfoHistory` channel, role in `ipc-access.ts`, handler in `page-info.ipc.ts`, `HistoryVisit` schema. Bridge and preload method `history(text, days)`.
3. **UI**: `history` icon, `HistoryDialog.tsx`, button in `AddressBar`, styles. Test alongside.
4. `npm run typecheck`, `npm test`, `npm run lint`.
