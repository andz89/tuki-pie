# Page images: plan

Spec: `docs/superpowers/specs/2026-11-10-page-images-design.md`

1. **Page script.** `collect-page.js` returns `images`: unique http(s) `img.src` values in page order, capped. Copy it to `packages/pie-extension/collect-page.js`. Test: duplicates, `data:` and non-web sources left out.
2. **Schema and report.** `images: list(Url)` in `PageData`; `PageReport.images`; `buildPageReport` passes it. Update fixtures in report and controller tests.
3. **Matching.** Move the "address contains every word" check into `matchesAddress` in `page-links.ts`; `filterLinks` and new `filterImages` (`page-images.ts`) use it. Export `ASK_ABOVE`. Tests for `filterImages`.
4. **Images tab.** `PageImages.tsx` with thumbnail, enlarge dialog, Broken marking, filter, Copy URL, Open, Open all with confirm. Third tab in `PageInfoWindow.tsx` with its count. CSS.
5. Run `npm test`, `npm run typecheck`, and `npm run lint`.
