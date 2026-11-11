# Page screenshot: plan

Spec: `docs/superpowers/specs/2026-11-10-page-screenshot-design.md`

1. **Extension capture.** New `packages/pie-extension/capture.js`, ported from tuki: `createCapture({ chrome })` with `capture(tabId)`. Debugger path (JPEG 80, full-page clip, scroll through first, always detach), stitch fallback on attach failure, height cap 30,000 px, tab brought to front and the previous one restored. Failures come back as `{ error: code }` in the result, because the request handler turns thrown errors into a bare `failed`. Tests in `capture.test.ts` with a fake `chrome`.
2. **Wire it.** `manifest.json` gets `debugger`. `protocol.js` `ACTIONS` gets `capture`. `tabs.js` `capture()` on the checked tab. `background.js` passes it.
3. **App side.** `chrome-site.ts`: `capture()` with a 60 second timeout. `PageSite.capture`. `PageInfoController.capture()` validates with zod, keeps the last picture, clears it in `startPage` and `endPage`, and offers `capturedImage()`. Tests in `chrome-site.test.ts` and `page-info-controller.test.ts`.
4. **IPC.** Channels `pageInfoCapture`, `pageInfoSaveCapture`, `pageInfoCopyCapture`; handlers in `page-info.ipc.ts`; preload and `PageInfoBridge`. `screenshot.ts` shares saving bytes to `Pictures\Pie Launcher` with a given name; `pageScreenshotFileName(title, time)` makes `<title> <date> <time>.jpg`.
5. **Screenshot tab.** `PageScreenshot.tsx`: Take screenshot button, progress, size line, stitched note, Retake, Save, Copy, picture fit to width, click for full size. Clears when the address or report changes. Fourth tab in `PageInfoWindow.tsx`. CSS.
6. **README.** One paragraph on the Screenshot tab and the new `debugger` permission.
7. Run `npm test`, `npm run typecheck`, and `npm run lint`.
