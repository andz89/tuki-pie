# Link filters: design

Date: 2026-11-10

Builds on `2026-11-10-link-safety-design.md`.

## What we are building

A **Link filters** panel inside the Links tab, listing every rule that hides a link or marks it as carrying a token. Each rule has a checkbox, checked by default. The user can also add their own words to block.

Decisions taken with the user:

- First a third tab; then moved inside the Links tab, opened by a "Link filters" button above the list. The button shows "(N off)" when any rule is off.
- Token or ID marking is one checkbox for all its rules.
- Users can add their own words.
- A "Hide duplicates" checkbox, checked, sits left of the Link filters button. It keeps one link per address: the first copy shown on the page, else the first copy. It is not saved; each window starts with it checked. The Links tab count follows it.

## What the user sees

```
 [ Page info ] [ Links (38) ]
                                      [Link filters (2 off)]
 Links matching a checked rule are hidden from the list below. [Check all]

 Change something when opened
  [x] delete  [x] remove  [x] trash  [x] destroy  [x] purge
  [x] logout  [x] logoff  [x] signout  [x] unsubscribe
 WordPress and WooCommerce
  [x] add-to-cart  [x] undo_item  [x] add_to_wishlist  [x] deactivate
  [x] cancel  [x] opt-out  [x] doing_wp_cron  [x] wp-login.php
 CMS backend (whole part only)
  [x] admin  [x] administrator  [x] wp-admin  [x] edit
 Theme customizer and page builders (whole part only)
  [x] customize_theme  [x] customize_changeset_uuid  [x] elementor-preview
  [x] fl_builder  [x] et_fb  [x] ct_builder  [x] brizy-edit  [x] vc_editable
 WordPress action links
  [x] A key with "nonce" (_wpnonce)   [x] preview=true
 Token or ID
  [x] Mark links that carry a token or an ID (Copy only, never opened)

 Your words
  [ checkout        ] [Add]
  [x] checkout  [Remove]
```

- Changes apply at once to the Links tab, and are saved.
- The Links tab counts only links still shown, and says "N hidden by Link filters" when any are.
- A word you add matches like an action word: anywhere in the path or query, as a word or as a whole part with separators removed. It is trimmed and lowercased; empty and duplicate words are refused. At most 100 words of 60 characters.
- "Check all" turns every built-in rule and every word of yours back on.

## How it works

- The page scripts (`collect-page.js`, `show-link.js`) list every followable link. Hiding moves to the app, so "Show on page" positions are over all links and stay right whatever is checked.
- `src/shared/link-rules.ts` holds the rules, their groups and `isBlocked(href, filter)`.
- One setting, `linkFilter`, holds JSON `{ off: string[], words: { word, on }[], tokens: boolean }`. `off` lists rule ids switched off, so a rule added later starts on. Bad JSON falls back to everything on.
- The main process checks every open request against the saved filter, hidden rules and token marking alike, so the window alone can't open what the filter blocks.

## Leaving links out (added later)

Decisions taken with the user: a checkbox on each row, ticked by default, and the choice lasts until the page is checked again (a new check or Refresh).

- Unticking leaves the address out: every copy of it, as Open all opens each address once. The row stays in the list, dimmed.
- Left-out links are not opened by Open all and not counted: the Links tab count, the summary, and the token note all skip them.
- "N left out of Open all and the counts. [Include all]" shows while any are left out.
- The single Open button on a left-out row still works: leaving out only affects Open all and the counts.
- A link marked as carrying a token or an ID starts unticked and is not counted. The user may tick it: then it counts, Open all opens it, and its Open button shows. The main process opens a marked link only when the window says it was ticked, and never a link a rule hides.
- "Include all" ticks every plain link again; marked links keep their ticks.
- HubSpot's `__hstc`, `__hssc` and `__hsfp` keys were briefly a hiding rule; the user asked to undo it. Links with them stay listed and marked as carrying a token, unticked to start.
