# Site tabs: design

Date: 2026-11-15

Builds on `2026-11-09-check-in-chrome-design.md` and `2026-11-11-site-dashboard-design.md`.

## What we are building

The Web Page window can hold several sites at once, as tabs across the top, like a browser.

The flow, in the user's words: you open a new tab in the app and enter a site. Chrome opens one tab and goes to that site. The page info is read and shown in that app tab.

Decisions taken with the user:

- A tab strip sits above the address bar. Each app tab has its own address, results, Dashboard, Page info, Links, Images and Screenshot.
- A new app tab opens from the **+** button, or from **Ctrl+click** / **middle-click** on a link's **Open** button in the Links list.
- Switching app tabs shows that tab's results at once. Nothing is checked again. Refresh checks it again, as today.
- Clicking the slice in the pie works as today, in the active app tab.
- Everything is kept in memory. Nothing is saved to disk, and tabs are not restored after a restart.
- No limit on the number of tabs.

## What the user sees

```
 [ Example Domain  x ][ Shop - Home  x ][ + ]
 [ https://shop.de/                 ] (go)(refresh)(go to tab)(pin)
 [ Highlight words in the results below    ]
  Dashboard | Page info | Links (42) | Images (12) | Screenshot
 ---------------------------------------------------------------
  results for shop.de
```

- A tab shows the page title, the address while there is no title yet, or "New tab" when empty.
- **x** closes an app tab and the Chrome tab it opened. Closing the last one leaves one empty tab.
- Closing the window closes the Chrome tabs its app tabs opened.
- A Chrome tab you opened yourself (for example the one the slice reads) is never closed.

## How it works

- Each app tab has an id. Every request from the app to the extension carries it, and every event from the extension carries it back, so results go to the right app tab.
- Extension (`tabs.js`): keeps `{ own, checked, committed }` per app tab id instead of one set. New action `forget(id)` closes the Chrome tab it opened for that app tab. A request without an id works on one default tab, as today.
- Main: one `PageInfoController` per app tab, unchanged inside. The window gets the active tab's updates as today, plus the tab strip on a new channel. New IPC: new tab, close tab, switch tab.
- Window: a `SiteTabs` strip. The content below is keyed by the active tab, so each tab keeps its own inner tab, ticks and screenshot.
