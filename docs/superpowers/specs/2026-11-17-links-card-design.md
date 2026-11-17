# Links Card: design

Date: 2026-11-17

Builds on `2026-11-16-info-card-design.md`.

## What we are building

On the Info Card, the **links** count tile becomes a button. Clicking it closes the Info Card and opens the **Links card** in its place: the page's links, listed as in Web Page's Links tab, for the tab in front in Chrome.

Decided with the user: the Info Card closes when the Links card opens (they swap).

## What the Links card does

Everything Web Page's Links tab does:

- Hide duplicates; Link filters (the same saved filters as Web Page, edited from the card too).
- Search by address; the counts; ticks per address with "N left out" and Include all; token and ID marking; the hidden-on-page hint.
- Per link: Show on page (in the Chrome tab in front), Copy URL, Open (a background tab in Chrome).
- Open all in Chrome, with the confirm above 15 and the cap of 100.
- A switch at the top, **Open links in: Chrome | Web Page** (chosen with the user: one switch for the card). Every Open and Open all follow it: Chrome opens background tabs; Web Page checks each link in its own Web Page tab. Remembered in the `linksOpenIn` setting (default Chrome). Web Page's own Links tab is unchanged (Open to Chrome, Ctrl+click here, both Open all buttons).

- A **Highlight** field (chosen with the user: list and page both). Its words are marked in each link address (the list hides nothing), and in the page's text in Chrome with mark.js 8.11.1 (MIT), copied to `packages/pie-extension/vendor/` with its licence and skipped by the formatter. Extension action `highlightActive { words, url }`: only in the tab in front while it shows the card page; no words clears. Typing waits 300 ms; a new page is marked again; closing the card clears. The search box goes back to filtering only on the card; Web Page's search box still highlights, as it has no separate field.

The card:

- Follows the tab in front, like the Info Card. A new page clears ticks and statuses.
- Pin, close, and the "Chrome in front only" rule are the same as the Info Card.
- Always sits down the right edge, 420 px wide, whatever the Info Card layout: a list does not fit a 140 px bar.
- A back button returns to the Info Card.

## Images card

Added after, the same way: the **images** count tile opens the **Images card** in the Info Card's place (view `images`), with Web Page's `PageImages` list (search, broken count, the viewer with previous and next, Copy URL, Open, Open all with the confirm). Images open only in Chrome, so it has no "Open links in" switch and no highlight field. `PageImages` takes its "open in Chrome" from `LinkActionsContext` too. `InfoCardPage` gains `images`; main lets the card fetch and open only the card page's images, through the same Link filters.

## How it works

- **Same window.** The card window has a view, `info` or `links`, kept in main so main can place it. Switching views is a message; the Info Card "closes" by turning into the Links card.
- **Links list reused.** `PageLinks` takes its three Web Page actions (show on page, open in Chrome, open here) from a new `LinkActionsContext`. Without a provider it uses Web Page's, as now (the same seam as `ChromeImageSourceContext`). The card provides its own.
- **Data.** `InfoCardPage` gains `links` (the report's links); `InfoCardState` gains `pageId` and `linkFilter`.
- **Main checks.** Each link the card asks to open or show must be one of the card page's links, and opening still goes through the saved Link filters (`canOpen`), as for Web Page.
- **Extension.** New action `showActiveLink { index, href, url }`: in the tab in front, only if it still shows `url`, it runs the same `showLinkOnPage` as Web Page. It does not bring Chrome forward (Chrome is already in front while the card shows, and focusing it would close an unpinned card).
- **Styles.** The list's classes are styled in `info-card.css`; Web Page's stylesheet is not loaded (its `.info-card` would clash).
