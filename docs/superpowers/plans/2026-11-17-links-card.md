# Links Card: plan

Spec: `docs/superpowers/specs/2026-11-17-links-card-design.md`.

1. **Extension**: `showActiveLink` in `active-tab.js` (checks the tab in front still shows the card's address, runs `showLinkOnPage`), added to `ACTIONS` and `background.js`. Tests in `active-tab.test.ts`.
2. **Shared**: `InfoCardPage.links`, `InfoCardState.pageId / linkFilter / view`, `InfoCardView`; channels `infoCardSetView`, `infoCardShowLink`, `infoCardOpenLinks`, `infoCardOpenHere`, `infoCardSetLinkFilter`; bridge methods; ipc-access roles.
3. **Main**: `cardPage` keeps links; window keeps the view and places the Links card down the right edge (`linksCardBounds`); handlers check links against the card page and the saved filters. Tests for the reader and bounds.
4. **Renderer seam**: `link-actions.ts` with `LinkActionsContext` and `useLinkActions`; `PageLinks` uses it, with the "here" wording from it. Web Page behaves as before.
5. **Renderer card**: the links tile is a button; `LinksView` (back, Hide duplicates, Link filters, `PageLinks`) with the card's actions; ticks kept per page; styles in `info-card.css`. Tests in `InfoCard.test.tsx`.
6. README and spec; typecheck, lint, format, tests.
