# Images from Chrome: design

Date: 2026-11-12

Closes B3 in `2026-11-11-deep-review-design.md`.

## Why

Page Info shows the checked page's images by loading them straight into its own window. So:

- every image server on the page sees a request from your computer, from Pie Launcher;
- a hostile page can list addresses on your local network, and Page Info requests them from inside it;
- images that need your Chrome login show as "Broken".

From now on Chrome gets the images, with your Chrome session, and hands them to Pie Launcher. The Page Info window never loads a page image itself.

## What the user sees

- **Images tab.** Each row's small picture appears as the row scrolls into view. Rows further down ask only when you get to them.
- **Big view.** Clicking a picture opens it full size. The full image is fetched then, not before. Previous and next fetch their image when you move to it.
- **Dashboard.** The image thumbnails and the social preview tile use small pictures.
- **Social card.** The preview is a small picture; clicking it shows the full image.
- **While a picture is on its way**, its spot shows a quiet empty box, as now while an image loads.
- **"Broken"** now means Chrome could not get it, or what came back is not an image.
- **Chrome not connected:** every image spot shows "Connect Chrome to see images". Nothing loads in the app.
- **Local images** (localhost, 192.168.x and similar) are fetched like any other. Checking a dev site on localhost shows its images.

Copy URL, Open and Open all are unchanged: they work with the address, not the picture.

## How it works

### In the extension: a new `image` action

`image({ url, size })`, with `size` either `thumb` or `full`.

- Only `http:` and `https:` addresses. Anything else answers `{ error: 'not-web' }`.
- Fetched from the service worker with `credentials: 'include'`, so Chrome sends your cookies where it allows them.
- At most 20 MB is read; a bigger image answers `{ error: 'too-large' }`.
- The answer must be an image type (`image/*`). Anything else answers `{ error: 'not-image' }`.
- `thumb`: the image is decoded and drawn at most 320 px on its longest side, then sent as WebP. SVG can't be decoded in a service worker, so an SVG is sent as it is (it is safe as an `<img>`, which runs no scripts), up to 2 MB.
- `full`: the bytes are sent as they came, so a GIF still moves.
- The answer is `{ dataUrl, width, height }`, `width` and `height` being the original size when known.
- A failed fetch or decode answers `{ error: 'failed' }`.

### In the main process

- A new channel `page-info:image (url, size)`, allowed for the Page Info window only.
- Main only asks Chrome for an address that is in the current report's images or share images. A script that got into the Page Info window can't use Chrome to fetch anything else.
- At most 4 image requests go to Chrome at once; the rest wait their turn.
- Answers are kept for the current page and dropped when the page changes (a new report id). The same picture asked twice is fetched once.
- Time limits: 15 s for a thumbnail, 30 s for a full image.

### In the window

- One `ChromeImage` component replaces the six `<img>` tags that load page images. It takes the address, the size, and whether to wait until it scrolls into view.
- It shows the placeholder when Chrome isn't connected, an empty box while waiting, the picture when it arrives, and tells its parent when the picture is broken (the Images tab counts them).
- Full images arrive as data addresses and are shown through one blob address each, released when the view closes or moves on.

### The Content-Security-Policy

`page-info.html` no longer allows `https:` and `http:` images. Only `'self' data: blob:`, like every other window. A page image that slipped through anyway would be blocked.

## Not in this

- The clear button for the in-app browser profile. It comes with the Show site button.
- Show site itself, which stays hidden and unchanged.

## Tests

- Extension: the `image` action for each answer above, with fake `fetch`, `createImageBitmap` and `OffscreenCanvas`.
- Main: the address check, the turn-taking, the per-page cache and its reset.
- Window: `ChromeImage` for each state, and the Images tab asking only for rows in view.
- CSP: Page Info no longer allows remote images.
