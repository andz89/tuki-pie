# Chrome history: design

Date: 2026-11-15

## What we are building

A **History** button at the end of the Page Info address row opens a modal that finds pages you visited in Chrome.

Decisions taken with the user:

- History comes **through the Pie extension** (`chrome.history`), so it covers the Chrome profile the extension is in and needs Chrome connected.
- Nothing loads until you press **Search**. You set two filters first:
  - **Days**: a number box, "visited in the last N days" (1 = last 24 hours). Default 1.
  - **Match** and **Address**: optional text. **Address is exactly** (the default) keeps visits whose address equals the text, ignoring case, `https://`, a leading `www.` and a trailing slash. **Address has text** keeps every visited address containing it, ignoring case: "flowsummit" finds every address with "flowsummit" in it. Only the address is checked, not the title. Empty text keeps every page.
- Clicking a row **opens that address in a new Page Info tab** and checks it, like Open in Page Info. Each row also has **Copy**.
- Each row has a **tick box**. **Open selected** opens every ticked page in its own new Page Info tab, in list order, and closes the modal. **Select all** ticks every row, or unticks them all, and shows a dash when only some are ticked. A new search clears the ticks.

## What the user sees

```
[ address ] (go)(refresh)(tab)(pin)(save)(saved)(history)

+---------------- Chrome history ---------------------------- (x) +
| Last [ 1 ] days [Address has text v] [ flowsummit ]  (Search)     |
|------------------------------------------------------------------|
| [ ] Flow Summit - Register                           14 Nov 10:42 |
| https://flowsummit.com/register                          [Copy]   |
| Flow Summit - Day 1                                  14 Nov 09:15 |
| https://flowsummit.com/day-1                             [Copy]   |
| [x] Flow Summit - Day 1  ...                                     |
| 2 pages                                   (Open selected (1))    |
+------------------------------------------------------------------+
```

Newest visit first. "No pages found." when empty. The button is disabled while Chrome isn't connected.

## How it works

- **Extension**: new `history` action (`history.js`) and the `history` permission. It asks `chrome.history.search` with empty text for the time range, matches the address itself (Chrome's own text search matches whole words only), and returns up to 1000 web addresses with title and last visit time. Manifest version 1.2.0; reload the extension once after updating.
- **Main**: `page-info:history` IPC (Page Info window only) checks the input (days 1 to 3650, text up to 200 characters), asks the extension, and checks the reply with a schema.
- **Renderer**: `HistoryDialog` in a `<dialog>`, opened from the new History icon. Row click calls the existing `newTab(address)`, so Link filters still apply.

One risk: Chrome reads at most 20000 visits per search, so a very long range with a rare word could miss old pages.
