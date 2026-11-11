# Safer page links: plan

Spec: `docs/superpowers/specs/2026-11-10-link-safety-design.md`

1. **More risky words.** Add the new action and backend words to `src/main/page-info/collect-page.js`, copy it to `packages/pie-extension/collect-page.js`, and add the same words to `packages/pie-extension/show-link.js`. Tests in `collect-page.test.ts` for each new word and for content links that must stay.
2. **Token check (shared).** `src/shared/link-tokens.ts` with `carriesToken(href)`. Tests first: secret keys, ID keys, random values, UUID and hex paths, tracking keys, WordPress read keys, mailto.
3. **Main guard.** `PageInfoController.openLinks` drops marked links and returns false when none are left. Test in `page-info-controller.test.ts`.
4. **Links list.** `openableUrls` skips marked links; add `countMarked`. `PageLinks.tsx` shows the skip note, the row hint, and no Open button on marked rows. Tests in `page-links.test.ts`.
5. Run `npm test`, `npm run typecheck`, and `npm run lint`.
