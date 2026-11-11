# Link filters: plan

Spec: `docs/superpowers/specs/2026-11-10-link-filters-design.md`

1. **Rules (shared).** `src/shared/link-rules.ts`: `LINK_RULES`, `RULE_GROUPS`, `LinkFilter` schema, `DEFAULT_LINK_FILTER`, `readLinkFilter(text)`, `isBlocked(href, filter)`, `canOpen(href, filter)`, `cleanWord(word)`. Tests carry over every case from the risky-link tests.
2. **Setting.** `linkFilter` text setting, default the JSON of `DEFAULT_LINK_FILTER`. Update the settings tests.
3. **Page scripts.** Remove the risky check from both `collect-page.js` copies and `show-link.js`. Their tests now expect risky links listed.
4. **Main.** New IPC `page-info:set-link-filter` saves the filter. `page-info:open-links` keeps only links `canOpen` allows under the saved filter. The controller drops its own token check.
5. **Links tab.** Number links first, then hide blocked ones, then apply the text filter. Tab count and summary use what is shown. `openableUrls` and the row's Open button follow the token checkbox.
6. **Link filters panel (inside the Links tab).** `LinkFilters.tsx` with the groups, checkboxes, Check all, and Your words. Store action `setLinkFilter`.
7. Run `npm test`, `npm run typecheck`, and `npm run lint`.
