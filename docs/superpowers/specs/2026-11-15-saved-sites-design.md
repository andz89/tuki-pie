# Saved sites: design

Date: 2026-11-15

Builds on `2026-11-15-site-tabs-design.md`.

## What we are building

You can save the site in the current Page Info tab, with all its results, and see your saved sites later, with a note for each.

Decisions taken with the user:

- A **Save** button in the address row saves the current tab's site.
- A saved entry keeps the **full results** from the moment you saved, the tab's **screenshot** if one was taken, and **your note**.
- **One entry per address.** Saving a site that is already saved asks first: "shop.de is already saved (15 Nov 2026). Replace the saved results? Your note is kept." [Replace] [Cancel].
- The **Saved sites** button opens a small menu: **Show here** (replaces the current tab with the saved list, with a Back button) or **Open in new window**.
- **Show here** closes the current tab, so it asks first when that tab has results: "Show saved sites here? This closes the current tab (shop.de) and its results." [Show here] [Cancel]. An empty tab closes without asking.
- Saved sites has its own color (violet accent and a violet-tinted background), so it never looks like Page Info.
- Everything stays on this computer: results and notes in Pie Launcher's database, screenshots as JPEG files in Pie Launcher's folder. Nothing is uploaded.

## What the user sees

Address row in Page Info:

```
[ https://shop.de/          ] (go)(refresh)(go to tab)(pin)(save)(saved sites v)
                                                                  | Show here          |
                                                                  | Open in new window |
```

- **Save** (bookmark icon): filled when this address is already saved. Disabled until the tab has results. A short "Saved." or "Replaced." shows under the row.
- **Saved sites** (list icon): the menu above.

Saved sites view, the same in both places:

```
 [< Back to Page Info]  Saved sites                     [ Search saved sites ]
 ---------------------------------------------------------------------------
 Shop - Home          | Shop - Home                      [Open in Page Info] [Delete]
 shop.de · 15 Nov     | https://shop.de/ · saved 15 Nov 2026, 10:42
 Example Domain       |
 example.com · 14 Nov | Note
                      | [ Client wants the GA4 tag checked before launch.     ]
                      |
                      | Page info | Links (42) | Images (12) | Screenshot
                      | ...the saved results...
```

- **Back to Page Info** shows only when it replaced the current tab. It goes back to the other open tabs, or to a new empty tab when there were none.
- The list: newest first, with title, address and date. The search box filters by title, address or note.
- The detail: the note (saves as you type), then the saved results:
  - **Page info**: the same cards as in Page Info (Issues, Details, SEO, Tracking, Comments). Social shows image addresses as text.
  - **Links**: the saved links as a plain list with Copy.
  - **Images**: image addresses as a plain list with Copy. Pictures are not shown: Chrome only fetches images for the page being checked.
  - **Screenshot**: the saved picture, with Save to Pictures and Copy. The tab is left out when none was saved.
- **Open in Page Info**: opens a new tab in the Page Info window and checks the site live. From the view that replaced Page Info, it also goes back to the tabs.
- **Delete**: asks once, then removes the entry and its screenshot file.

## How it works

- **Database**: migration `009_saved_sites.sql` adds `saved_sites (id, address UNIQUE, title, report TEXT, note, has_screenshot, saved_at, updated_at)`. `report` is the `PageReport` as JSON, checked with its schema when read back.
- **Screenshots**: `<userData>/saved-sites/<id>.jpg`, written when saving, replaced when replacing, deleted with the entry. Read through IPC as a data address only for the entry being shown.
- **Main**: `SavedSiteRepository` and `SavedSiteService` (save, list, get, set note, remove, find by address). Saving reads the active Page Info tab's report and kept screenshot in main, so no window ever sends a report or picture to be stored.
- **One view, two places**: a `SavedSites` component in the renderer, talking to `window.savedSites`. The Page Info preload exposes `window.savedSites` too, so the view can replace the Page Info content there. The new window is `saved-sites-window.ts` with `saved-sites.html`, its own preload and the role `saved-sites`.
- Changes reach every open view, so the Save icon and the lists stay current.
- **Reuse**: the Page info cards move behind a small `PageInfoCards` component that Page Info and Saved sites both use.
