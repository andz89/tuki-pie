# Images from Chrome: plan

Spec: `docs/superpowers/specs/2026-11-12-images-from-chrome-design.md`.

Test first for each task, then `npm run typecheck`, `npm run lint`, `npm test`. One commit per task.

| #   | Task                                                                                                                                                                   | Test                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Extension: `image.js` with `fetchImage({ url, size })`; add `image` to `ACTIONS` and wire it in `background.js`.                                                       | `image.test.ts`: not-web, too-large, not-image, thumb (decoded, at most 320 px, WebP), SVG as is, full as is, failed. |
| 2   | Main: `page-info:image` channel, Page Info window only; address must be in the current report; 4 at a time; per-page cache keyed by report id; 15 s / 30 s limits.     | `page-info.ipc.test.ts` and a small image queue test.                                                                 |
| 3   | Window: `pageInfoBridge.image`, a `ChromeImage` component (placeholder, waiting, ready, broken; optional wait for view; blob address for full images).                 | `ChromeImage.test.tsx` in jsdom.                                                                                      |
| 4   | Use `ChromeImage` in the Images tab rows and big view, the dashboard thumbnails and social tile, and the social card. Remove `shareImageSource` uses that load images. | Existing tests updated; the Images tab asks only for rows in view.                                                    |
| 5   | CSP: drop remote images from `page-info.html`.                                                                                                                         | `csp.test.ts`.                                                                                                        |
| 6   | README: images come from Chrome; Show site is hidden for now.                                                                                                          | none                                                                                                                  |
