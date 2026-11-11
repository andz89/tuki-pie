# Page screenshot: design

Date: 2026-11-10

Builds on `2026-11-09-page-info-design.md` and `2026-11-09-check-in-chrome-design.md`. The capture follows tuki's `captureFullPage` (`tuki-main/src/background/screenshot.js`, `debuggerSession.js`, `scrollThrough.js`).

## What we are building

A **Screenshot** tab next to **Images** in the Web Page window. It shows the whole checked page, top to bottom, as Chrome draws it, logins included.

Decisions taken with the user:

- The picture is a JPEG, so it stays small (a long page is about 1 to 5 MB).
- It is taken only when the user presses **Take screenshot**. Opening or switching to the tab never takes one, and a Page Info check never takes one either.
- Capture works as in tuki: Chrome's debugger first, scroll and stitch when the debugger can't attach.

## What the user sees

```
 [ Page info ] [ Links (42) ] [ Images (18) ] [ Screenshot ]

 Before:
   A picture of the whole page, as Chrome shows it.
   [ Take screenshot ]

 While taking it:
   Taking the screenshot...  (the button is disabled)

 After:
   1280 x 9,840 px · 2.3 MB                [Retake] [Save] [Copy]
   +---------------------------------------------+
   |  the page, fit to the window's width,       |
   |  scrolls inside the tab                     |
   +---------------------------------------------+
```

- The picture is shown at the window's width and scrolls inside the tab. Clicking it opens it at full size, Escape closes, as the Images viewer does.
- **Save** writes `<page title> <date time>.jpg` to `Pictures\Pie Launcher` and shows the same "Click to show it" notice as the Screenshot slice.
- **Copy** puts the picture on the clipboard.
- **Retake** takes it again (the page may have changed).
- When it was stitched, a line under the size says: "Chrome didn't allow a one-pass capture here, so the page was scrolled and stitched. Fixed headers appear once, at the top."
- A new check, Refresh, or following another tab clears the picture, so it never shows a different page than the cards.
- Without Chrome connected, or with no page checked, the button is disabled with the reason underneath, as for Open.
- Errors are shown in the tab in plain words, for example "Close DevTools (F12) on this tab, then try again." or "Chrome doesn't allow capturing this kind of page."

Chrome shows its "started debugging this browser" bar while the debugger is attached. Attaching lasts only as long as the capture, as in tuki.

## How it works

### Extension (`packages/pie-extension`)

- `manifest.json`: adds the `debugger` permission. Chrome asks the user to accept it once, when the extension updates.
- New `capture.js`, ported from tuki:
  - `captureCheckedTab(tabId)`: brings the tab to the front (a hidden tab doesn't paint), restores the previous tab afterwards.
  - Debugger path: attach, run `scrollThrough` once so lazy images load, read `Page.getLayoutMetrics`, then `Page.captureScreenshot` with `format: "jpeg"`, `quality: 80`, `captureBeyondViewport: true`, clip to the full page. Always detach in `finally`.
  - Stitch path, when attach fails (DevTools open, another extension on the tab): scroll and `captureVisibleTab` one screen at a time, at most 2 per second and 80 frames, hide fixed and sticky elements after the first frame, draw onto an `OffscreenCanvas`, restore the page, export `image/jpeg` at 0.8.
  - Height cap: a page taller than 30,000 image pixels is scaled down to fit (a JPEG cannot exceed 65,535 px, and Chrome may leave very tall captures blank).
  - Returns `{ dataUrl, width, height, method: 'debugger' | 'stitched' }`, or throws a short error code (`devtools-open`, `other-extension`, `not-allowed`, `timeout`).
- `protocol.js`: `ACTIONS` gets `'capture'`.
- `tabs.js`: `capture()` runs `captureCheckedTab(await checkedTab())`.
- `background.js`: wires `capture: tabs.capture`.

### App

- `chrome-site.ts`: `capture: () => bridge.request('capture', undefined, CAPTURE_MS)` with `CAPTURE_MS = 60_000`, because the stitch path can take about 50 seconds. Every other request keeps 10 seconds.
- `page-info-controller.ts`: `capture()` asks the site and checks the answer with zod: the data URL must start with `data:image/jpeg;base64,` and be under `MAX_MESSAGE_BYTES`, width and height positive integers.
- `page-info.ipc.ts`: `pageInfoCapture` (returns the picture or an error message), `pageInfoSaveCapture`, `pageInfoCopyCapture`. Saving and copying use the last picture kept in the main process, so the window never sends the image back.
- `screenshot.ts`: the save part of `saveScreenshot` is shared, taking the bytes and the extension (`.jpg` here, `.png` for the slice).
- `src/renderer/page-info/PageScreenshot.tsx`: the tab. The picture lives in the window's state only, it is not stored in the database.
- `PageInfoWindow.tsx`: `TABS` gets `screenshot`.

## Tests

- `capture.test.ts` (extension): debugger path asks for JPEG with the full-page clip and always detaches; attach failure falls back to stitching; DevTools and other-extension errors map to their codes; tall pages are scaled under the cap.
- `chrome-site.test.ts`: capture uses the 60 second timeout.
- `page-info-controller.test.ts`: a non-JPEG or oversized answer is refused; a new check clears the kept picture.
- `PageScreenshot` render test: nothing is captured on opening the tab; the button sends one capture.

## Not in this version

- Phone or tablet sized screenshots (tuki's device emulation).
- Picking a section of the page.
- Keeping screenshots between checks or in history.

## Addendum 2026-11-11: View as (size before the screenshot)

- A **View as** menu above the button, as in tuki: Desktop (the tab as it is), then Chrome DevTools' devices in groups (Mobile, Foldables, Tablets, Smart Displays). The choice stays across pages.
- The user chose capturing directly in the tab (no preview window as in tuki). The debugger emulates the device (`setDeviceMetricsOverride` at its width, `mobile: true`, scale 1; touch; its user agent), the page is scrolled through for lazy images, then made as tall as the page and captured.
- Optional **Reload the page as this device first**: `Page.reload` under emulation, and one more reload after detaching so the tab is itself again. Page Info ignores navigation events while capturing, so these reloads don't start a new check.
- No stitched fallback for a device (it would be the desktop page under a device name): error `no-device`, or `devtools-open` / `other-extension` when known.
- Device list lives in `packages/pie-extension/devices.js` (with user agents) and `src/shared/devices.ts` (names and sizes); a test checks they match. The saved file name includes the device.
- Desktop capture no longer uses `captureBeyondViewport`: it repeated the visible part on some pages. The viewport is briefly made as tall as the page instead.
