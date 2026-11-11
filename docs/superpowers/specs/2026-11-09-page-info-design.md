# Page Info: design

Date: 2026-11-09

## What we are building

A way to check a website's details without leaving Pie Launcher. A new **Page Info** slice opens a small window with an address bar and info cards. The website itself loads in a hidden background window, the app reads the page, and the cards show what it found. The checks come from the Tuki extension's Page Info feature.

## What the user sees

### The slice

- Page Info sits just before Settings, so the ring has five slices.
- The center shows "Page Info" and "Check a website".
- Clicking the slice opens the Page Info window, or brings it forward if it is open.
- If the clipboard holds one full `http` or `https` address, that page loads right away. Anything else in the clipboard is ignored and the address bar stays as it was.
- If the window already shows that address, it does not load again.
- The slice has no circles.

### The Page Info window

- The address bar is at the top, with **Check**, **Refresh** and **Show site** buttons.
- An address without `http://` or `https://` gets `https://`. Other kinds of address are refused with "Enter a web address, like example.com."
- While a page loads, the window shows "Checking…".
- Under the address bar, the window shows the address the page actually ended on, so a redirect or a login page is visible.
- Cards fill the rest of the window. They read the same in light and dark themes, following the app's theme setting.
- All addresses in the cards are plain text. Nothing in a card can be clicked to open a site.

### The cards, in order

1. **Issues:** every problem found, errors first.
2. **Page details:** title, description, language and canonical URL. Title and description show a character count, highlighted outside the recommended range (title up to 60, description 50 to 160). A missing value says "Missing".
3. **SEO:** robots rules, headings as an indented outline, and hreflang language versions.
4. **Tracking:** the tags found with their IDs, scripts loaded more than once, UTM links missing values, files loaded over http, and new-tab links without `noopener`. It always notes that tags waiting for cookie consent only appear after cookies are accepted.
5. **Social:** the first `og:image` and `twitter:image` addresses, each with a preview of the image. Only `http` and `https` images load.
6. **Comments:** the Hyvor Talk widget's settings, or "None found".

Long lists stop at 50 items (headings 200, hreflang 100) and say "Showing 50 of 120".

### The hidden site

- **Show site** opens the background window so the real page is visible. The button then reads **Hide site**.
- The site window's title bar shows the current address.
- In the visible site window, clicking around updates the cards. A link that opens a new tab loads in the same window.
- Closing the site window with its X only hides it.
- Closing the Page Info window closes the site too, and nothing keeps running.

### Reading the page

- The page is read when it finishes loading, and again 1.5 seconds later, because tags often load late.
- It is also read when a single-page site changes its address without reloading.
- **Refresh** reloads the page and reads it again.
- A late answer from an older page is ignored.
- If a page cannot open, the window says "Could not open that page."
- If it takes over 30 seconds, the window says "That page took too long." and shows whatever could be read.

## Safety

- The site window has no access to the app: no preload script, no Node, sandboxed, and separate from every other window.
- It has its own stored cookies, shared with nothing else, so accepted cookie banners and logins are remembered until the site ends them.
- Only `http` and `https` pages can load. The check runs when an address is entered and on every navigation.
- Sound is muted while the window is hidden.
- Downloads, pop-ups, and requests for camera, microphone, location and notifications are blocked.
- The reading script runs in a private layer that the page's own code cannot see or change.
- What comes back from a page is untrusted. The main process checks its shape and size before using it, and the cards show it only as text, apart from the share image previews.
- Only pages opened in this window are read. Results stay in memory and are never saved.
- Any site can open here, so the window is not meant for logging in to important accounts.

## Not in this work

- The rest of Tuki: tours, notes, go/no-go rules, and choosing which info to show.
- Saving or exporting results, or comparing pages.
- Reading inside iframes. Only the main page is read.
- Tabs, or checking several sites at once.

## How it is built

### Page reader

`src/main/page-info/collect-page.js` is one self-contained script with no imports, loaded with `?raw` the same way as the SQL migrations. It reads the page and returns plain data: the title, description, language, canonical URL, robots tags, headings, hreflang links, resources, tracking sources, link addresses, new-tab links without `noopener`, share images and the Hyvor Talk element. It comes from Tuki's `content/modules/pageInfo.js` and `pageAudit.js`.

### Checks

`src/shared/page-audit.ts` is Tuki's `shared/pageAudit.js`, converted to TypeScript with its behavior unchanged. `src/shared/page-issues.ts` is Tuki's `pageIssues.js`, without the option for hiding items.

`src/main/page-info/page-report.ts` turns validated page data into the report the cards show. A zod schema in `src/shared/schemas/page-info.schema.ts` limits every list and string, and data that fails is treated as "Could not read that page."

### Windows

- `src/main/windows/page-info-window.ts` creates the Page Info window, following `panel-window.ts`.
- `src/main/windows/site-window.ts` owns the hidden `BrowserWindow`: `show: false`, `backgroundThrottling: false`, partition `persist:page-info`, and no preload.
- It reads the page with `executeJavaScriptInIsolatedWorld`, and uses a counter so only the newest read counts.
- Its session denies all permissions and cancels downloads.
- The close handler hides the window only while the app is not quitting and the Page Info window is open.
- The rule in `main.ts` that blocks all navigation gets one exception, for this session only. There, only `http` and `https` are allowed.

### Messages

- A new preload, `page-info-preload.ts`, gives the Page Info window `check(address)`, `refresh()`, `setSiteVisible(visible)` and `onUpdate(listener)`. Forge builds it alongside the other preloads.
- Every message is validated with zod through `handle()`.
- The main process sends updates with the status, the final address, and the report.
- The donut gets one new call, `window.openPageInfo()`. The main process reads the clipboard itself, so the donut never sees it.

### Screens

- `page-info.html` joins the renderer's inputs in `vite.renderer.config.mts`.
- `src/renderer/page-info/` holds the window, its store, and one small component per card.
- `RING_ITEMS` gains Page Info, `SETTINGS_INDEX` becomes 4, `PAGE_INFO_INDEX` is 3, and `SliceIcon` gains a `page-info` icon.

## Testing

Tests are written first with vitest:

- Checks: Tuki's existing tests, carried over.
- Reader: sample HTML through the real script, using jsdom as a new test-only dependency.
- Report: blank or missing values, list limits, and data that fails validation.
- Address handling: adding `https://`, refusing other schemes, and which clipboard contents count.
- Navigation rule: `http` and `https` allowed, `file:`, `javascript:` and others refused, and other windows still blocked.
- Reads: a late answer from an older page is ignored.
- IPC: bad input is refused.
- Stores and slice: the new ring order, and the states shown in the Page Info window.

Window behavior is checked in a real run with a throwaway data folder: loading a public page, redirects, Show and Hide site, closing the window, and quitting while the site is shown.
