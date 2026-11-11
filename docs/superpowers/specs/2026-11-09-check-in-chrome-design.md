# Check in Chrome: design

Date: 2026-11-09

## What we are building

A way for Page Info to read a website in real Chrome, with your logins, Chrome's updates and Safe Browsing. A small Chrome extension does the reading and sends the result to Pie Launcher over a local WebSocket. The hidden site window stays, so Page Info still works without Chrome.

## What the user sees

### Setup, once

- Load the extension in Chrome from `packages/pie-extension` (Developer mode, **Load unpacked**).
- Settings has a **Chrome** section with the pairing code, a **Copy** button and a **New code** button.
- Paste the code into the extension's popup. The popup then shows one of:
  - **Connected**
  - **Not connected**: the app isn't running, or the pairing is still being set up.
  - **Pairing code doesn't match**: paste the code from Settings again.
  - **Another Chrome profile is connected**, with a **Connect** button that takes over.
- Settings shows **Chrome connected**, **Chrome not connected**, or **Port in use by another program** if the app couldn't start listening.
- **New code** makes a fresh code and disconnects Chrome until the new code is pasted. The old code stops working at once.

### Using it

- The Page Info window gets a **Check in Chrome** button beside **Check**. Pressing Enter in the address bar still means **Check**.
- If the address is already open in a Chrome tab, that tab is read as it is: no new tab, no reload, and you stay logged in with anything you typed kept. If several tabs match, the active tab wins, otherwise the one you used most recently.
- Otherwise **Check in Chrome** opens the address in a background Chrome tab, so you can keep working. That tab is reused for each new check, so tabs don't pile up. If you closed it, a new one opens.
- A tab you opened yourself is never sent to another address. A new check for a different site uses the extension's own tab.
- An address matches when it is the same apart from anything after `#`. A redirect can mean no match, for example `example.com` against an open `www.example.com`, and then a new tab opens.
- The cards are the same as today, and they update if you click around in that tab.
- The page is read when it finishes loading, 1.5 seconds later, and once more 5 seconds after loading. The last read catches tags that load late, because Chrome runs a tab you can't see more slowly. The Tracking card can gain an item when it arrives.
- The same three reads happen for a tab that was already open. If it has finished loading, they start right away. If it is still loading, they start when it finishes.
- **Go to tab** and **Refresh** are optional. Getting the page info never needs either one.
- **Go to tab** replaces **Show site**. Press it if you want to see the website itself: it minimizes the Page Info window and brings Chrome forward on that tab. Minimizing first also helps Windows let Chrome come to the front. There is no Hide, because Chrome can't hide a tab. If Windows won't let Chrome come forward, Chrome flashes in the taskbar instead.
- **Refresh** loads the page again and reads it again, for example after the site changed. On a tab you opened yourself, it reads again without reloading, so nothing you typed is lost.
- If you close the tab, the window says "The Chrome tab was closed."
- If you press Stop in Chrome while a page is loading, the check ends at once with "Could not open that page", just as it does when a page stops loading in the hidden window.
- If a page takes over 30 seconds and nothing has arrived yet, the extension's own tab is cleared to a blank page, so a slow page can't turn up later and start a new check. A tab you opened yourself is never cleared.

### When it can't work

- If Chrome is closed or the extension isn't paired, **Check in Chrome** is disabled and shows "Chrome not connected".
- Chrome doesn't let extensions read `chrome://` pages, the Web Store or PDFs, so those show "Could not read that page."
- A page whose data is over 32 MB shows "Could not read that page." Real pages are far below this.
- Only one Chrome profile is connected at a time. A newer one takes over, and the older one waits until you press **Connect** in its popup or restart that Chrome.
- If you open the app after Chrome, linking up can take about 30 seconds, because Chrome lets extensions retry only that often.

### Clicking the Page Info slice

- If Chrome is connected, Page Info checks the active tab in the Chrome window you used last, every time you click the slice. It's read as it is, with no new tab and no reload.
- The active tab comes before a copied address. A copied address is checked in the hidden window only when Chrome has no web page to offer, for example when it isn't connected or its tab is a `chrome://` page.
- Nothing loads again if the window already shows that page, ignoring anything after `#`.
- A click always starts a new check, even if the last one is still loading.
- Asking Chrome takes at most 1.5 seconds, and the window opens straight away either way. If you start a check yourself while it waits, yours wins.
- Page Info doesn't follow the tab while it stays open. Click the slice again to check the tab you're on now.
- Only Chrome, through the extension. Other browsers can't be read without their own extension.

### What stays the same

**Check** keeps using the hidden window.

## Safety

- The server listens on `127.0.0.1` only, never on the network.
- It accepts a connection only when the `Origin` is exactly `chrome-extension://<fixed id>`. This blocks websites. Other programs can fake `Origin`, so the handshake below is the real check.
- The extension and the app each prove they know the pairing code, and neither proves itself until the other has. A program posing as either side is refused.
- The code itself never travels over the connection.
- The pairing code is 32 random bytes from the app, shown as text meant to be copied, not typed.
- The code is stored in the app's database, apart from the general settings. Only the Settings window can read it. The Page Info window and the donut never receive it.
- The app can only ask for a fixed list of actions: open, reload, stop, read, go to tab. It can never send scripts to run.
- The extension opens only `http` and `https` addresses.
- The extension reads only its own tab, or a tab already showing the exact address you asked for. When you click the Page Info slice, it gives the app the address of the active tab, and nothing else from it. It only ever changes the address of its own tab, and never reloads or clears one of yours.
- Everything received is untrusted. `buildPageReport` validates it as it does today, and cards show it as text.
- Results stay in memory and are never saved.

## How it's built

### The handshake

`cE` and `cA` are 32 random bytes each, sent as hex. `k` is the pairing code. Signatures use HMAC-SHA-256 and are compared in constant time.

1. Extension to app: `{ type: 'hello', nonce: cE }`.
2. App to extension: `{ type: 'challenge', nonce: cA, proof: HMAC(k, 'pie-app|' + cE + '|' + cA) }`.
3. The extension checks the proof. If it's wrong, it closes without answering and shows "Pairing code doesn't match".
4. Extension to app: `{ type: 'proof', proof: HMAC(k, 'pie-ext|' + cA + '|' + cE) }`.
5. The app checks it. If it's right, it sends `{ type: 'ready' }`. If it's wrong, it closes with code `4002`.

The two sides sign different text (`pie-app` and `pie-ext`), so one side's proof can never be bounced back as the other's.

### Close codes

| Code          | Meaning                          | Extension does                                                    |
| ------------- | -------------------------------- | ----------------------------------------------------------------- |
| `4001`        | Replaced by a newer connection   | Stops retrying, popup shows "Another Chrome profile is connected" |
| `4002`        | Pairing code doesn't match       | Stops retrying, popup shows "Pairing code doesn't match"          |
| anything else | App closed, crashed or restarted | Retries as normal                                                 |

The extension starts retrying again when a code is pasted, **Connect** is pressed, or Chrome starts. This stops two paired profiles from taking turns knocking each other off.

### Extension: `packages/pie-extension/`

- `manifest.json`: Manifest V3, with a `key` so the extension ID stays fixed. Only the public key goes in the repository. Permissions are `scripting`, `storage`, `alarms` and `webNavigation`. Host permission is `<all_urls>`, because no click happens inside Chrome.
- `background.js`: holds the connection, runs the actions and reports tab events.
- `popup.html` and `popup.js`: the pairing code field, the status and the **Connect** button.
- `collect-page.js`: a copy of `src/main/page-info/collect-page.js`. A test fails if the two files differ, so no build step is needed.

Connection behaviour:

- Connect when the service worker starts, on `onStartup` and on `onInstalled`.
- Retry after 1, 3 and 10 seconds, then every 30 seconds with `chrome.alarms`.
- Send a ping every 20 seconds, so Chrome doesn't suspend the worker.
- Keep two tab IDs in `chrome.storage.session`, so they survive the worker going to sleep: the extension's own tab, and the tab being checked, which may be one of yours. Keep the pairing code in `chrome.storage.local`.

### Actions

Every request from the app carries an `id`, and the answer carries the same `id`, so an answer is never matched to the wrong request.

| Action      | What the extension does                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open(url)` | Refuses anything but `http` and `https`. Looks for an open tab with the same address (ignoring `#`), skipping tabs Chrome has put to sleep to save memory. If one is found, it becomes the tab being checked: the extension sends `committed`, and also `loaded` if the tab has finished loading. Otherwise it updates its own tab to the address, or creates an inactive one in the last focused window if it's gone |
| `reload`    | On its own tab, `chrome.tabs.reload`. On one of your tabs, it sends `committed` and `loaded` without reloading, so the page is read again                                                                                                                                                                                                                                                                             |
| `stop`      | Runs `window.stop()` in the tab. On its own tab only, if that can't run because nothing has loaded yet, it sends the tab to `about:blank`                                                                                                                                                                                                                                                                             |
| `read`      | `chrome.scripting.executeScript` with `files: ['collect-page.js']` in the isolated world, main frame only, and returns the result                                                                                                                                                                                                                                                                                     |
| `goToTab`   | Activates the tab and focuses its Chrome window                                                                                                                                                                                                                                                                                                                                                                       |
| `activeTab` | Gives the address of the active tab in the Chrome window used last, if it is a web page. Reads nothing from the page                                                                                                                                                                                                                                                                                                  |

### Events

Only events for the tab being checked and `frameId === 0` are sent.

Finding the open tab needs no new permission. The `<all_urls>` host permission already lets the extension see each tab's address.

| Chrome event                                                               | Sent as          | Controller call                                      |
| -------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------- |
| `webNavigation.onCommitted`, `http` or `https` address only                | `committed`      | `sitePageCommitted()`                                |
| `webNavigation.onCompleted`                                                | `loaded`         | `siteLoaded()`                                       |
| `webNavigation.onHistoryStateUpdated` and `onReferenceFragmentUpdated`     | `changedInPlace` | `sitePageChangedInPlace()`                           |
| `webNavigation.onErrorOccurred`, not `net::ERR_ABORTED`                    | `failed`         | `siteFailed(code)`                                   |
| `webNavigation.onErrorOccurred`, `net::ERR_ABORTED`, tab no longer loading | `cancelled`      | `siteCancelled()`                                    |
| `webNavigation.onErrorOccurred`, `net::ERR_ABORTED`, tab still loading     | nothing          | A newer load replaced it                             |
| `tabs.onRemoved`                                                           | `closed`         | `siteClosed()`, message "The Chrome tab was closed." |

Committed events for other kinds of address are dropped, as the hidden window drops them today. This keeps `about:blank` from the stop action, and Chrome's own pages, from starting a check.

### App: `src/main/chrome-bridge/`

- A WebSocket server using the `ws` package, on port 17361. Tuki's helper uses 17345. `ws` is bundled into the main process by Vite, as `zod` is. Its optional speed-up modules are not shipped, and `ws` falls back to plain JavaScript. A packaged build is checked to confirm this.
- It starts with the app, not with the Page Info window, so the status is always known.
- If the port is in use, the server reports it to Settings and tries again every 30 seconds.
- At most two connections can be mid-handshake at once. Others are closed straight away.
- A connection that hasn't finished the handshake within 5 seconds, or sends a message over 4 KB before finishing it, is closed.
- No message may be over 32 MB. A larger page answer closes nothing, it just counts as a failed read.
- The newest authenticated connection replaces the older one, which is closed with `4001`.

### Reusing the Page Info code

`PageInfoController` already talks to the page through the `SiteView` interface. The new work is a second implementation of it, `createChromeSite`, that sends actions over the bridge.

A small wrapper, `SiteSwitch`, holds both sites and knows which one is active:

- **Check** makes the hidden window active. **Check in Chrome** makes Chrome active.
- Switching to Chrome hides the hidden window and sets `siteVisible` to false.
- Events from the inactive site are ignored.
- **Go to tab** is its own message, `pageInfoGoToTab`, and does not change `siteVisible`.

The 30-second limit, the 5-second read limit, the second read after 1.5 seconds, and the rule that ignores late answers all stay in the controller unchanged.

The controller gains one setting, the extra read: 5 seconds after loading for Chrome, none for the hidden window, which isn't slowed down. It follows the same rules as the 1.5-second read:

- A new page, Refresh, a new check or a failure cancels it.
- If it fails, the report already on screen stays.
- A page that changes its address in place schedules it again.

### Messages and screens

- `pageInfoCheck` gains a source: `'window'` or `'chrome'`.
- New message `pageInfoGoToTab`.
- `PageInfoUpdate` gains `source` and `chromeConnected`. The Page Info window gets a new update whenever the connection status changes.
- `PageInfoWindow.tsx` gains the **Check in Chrome** button and shows **Go to tab** when the source is Chrome.
- The Settings window gains the **Chrome** section, through its own messages for reading the status, reading the code and making a new code.

### If the connection drops

Any waiting read returns nothing. If Chrome was the active source, the window shows "Chrome not connected" and clears the cards, as with a failed page. If the hidden window was active, nothing changes except the button.

## Testing

Tests are written first with vitest:

- Handshake: correct code, wrong code, wrong `Origin`, over 4 KB before finishing, timeout, and a third connection while two are mid-handshake.
- Reflection: a proof made with the `pie-ext` text is refused where `pie-app` is expected, and the other way round.
- Fake app: the extension refuses a server that can't prove the code, and never sends its own proof.
- Close codes: after `4001` or `4002` the extension stops retrying, and after other codes it retries.
- Two profiles: the replaced one doesn't reconnect by itself.
- Action and event mapping, including aborted loads with and without a newer load, and the dropped `about:blank` commit.
- Request IDs: a late answer to an old read isn't matched to a newer one.
- `SiteSwitch` ignores events from the inactive site and hides the window when switching to Chrome.
- The extra read: it runs 5 seconds after loading in Chrome only, is cancelled by a new page, Refresh, a new check or a failure, and a failed extra read keeps the earlier report.
- A dropped connection during a read.
- The pairing code never appears in `Settings` or in any Page Info message.
- The extension's copy of `collect-page.js` matches the app's.
- Address checks refuse anything but `http` and `https`.
- Open tabs: a matching tab is read without a new tab or a reload, the active tab wins over others, a tab asleep to save memory is skipped, and a different `#` still matches.
- Your own tabs: a new check for another site never changes their address, Refresh never reloads them, and the 30-second limit never clears them.

A real run with Chrome then covers pairing, **New code**, a site already open in a tab (including one with a half-filled form), a public page, a logged-in page, redirects, a single-page site, Refresh, Go to tab, Stop in Chrome, closing the tab, closing Chrome during a check, two profiles, and a packaged build.

## Not in this work

- Publishing to the Chrome Web Store. All-sites access usually means a slower review.
- Native messaging or a helper `.exe`.
- Following the active tab while Page Info stays open.
- Connecting several Chrome profiles at once.
- Starting Chrome from the app when it's closed.
