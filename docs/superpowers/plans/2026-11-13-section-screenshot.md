# Section screenshot: plan

Spec: `docs/superpowers/specs/2026-11-13-section-screenshot-design.md`

1. **Extension capture** (`packages/pie-extension/capture.js`): add `sectionBox`, the `selector` option, the clip in `withDebugger`, the box range in `stitch`, and the new errors. Tests in `capture.test.ts`.
2. **Extension tabs** (`tabs.js`): pass `section` on as `selector`, cut to 500 characters. Test in `tabs.test.ts`.
3. **Types and IPC**: `CaptureSize.section`, `PageScreenshot.section` and `matches`, the IPC schema, the new problem texts and `matches` in the controller. Tests in `page-info-controller.test.ts`.
4. **File name**: `pageScreenshotFileName` takes the section. Test in `screenshot-geometry.test.ts`.
5. **Screenshot tab**: the Section field, the heading and the "N elements match" note. Store default `section: ''`.
6. `npm run typecheck`, `npm test`, `npm run lint`.
