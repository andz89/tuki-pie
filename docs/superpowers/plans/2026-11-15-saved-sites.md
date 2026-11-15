# Saved sites: plan

Spec: `docs/superpowers/specs/2026-11-15-saved-sites-design.md`

1. **Database**: `009_saved_sites.sql`, `SavedSiteRepository`, `SavedSiteService`, schemas in `src/shared/schemas/saved-site.schema.ts`. Tests alongside.
2. **IPC**: channels, `saved-sites.ipc.ts` (list, get, setNote, remove, openLive), Page Info gets save and isSaved, roles in `ipc-access.ts`, change events to both windows. Tests alongside.
3. **Window**: `saved-sites-window.ts`, `saved-sites.html`, renderer entry, `saved-sites-preload.ts`, build config entries.
4. **Reuse**: `PageInfoCards` from the Page info tab, used by both windows.
5. **Page Info buttons**: Save and Saved sites in `AddressBar`, with the store's `isSaved`.
6. **Saved sites window UI**: list, search, detail, note, Links and Images lists, Open in Page Info, Delete, violet theme. Tests alongside.
7. `npm run typecheck`, `npm test`, `npm run lint`. Try it in the real app.
