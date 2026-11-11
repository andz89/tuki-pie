# Site dashboard: design

Date: 2026-11-11

Builds on `2026-11-09-page-info-design.md`, `2026-11-10-page-images-design.md` and `2026-11-10-page-screenshot-design.md`. Mockup: https://claude.ai/artifact/7Z4oz17f9JXV6uwZt6pzw7

## What we are building

A **Dashboard** tab, first in the Web Page window, that shows everything about the checked page on one screen. Each tile opens the tab that has the details.

Decisions taken with the user:

- Dashboard is a new tab next to **Page info**; the cards stay as they are.
- The tiles keep a fixed order (no dragging).
- The window opens on Dashboard.
- Modern look and motion are welcome, as long as it stays in the app's theme (dark and light, accent color).

## What the user sees

```
 [ Dashboard ] [ Page info ] [ Links (142) ] [ Images (38) ] [ Screenshot ]

 +--------------------------------------------------------------+
 | E  Handmade Ceramics Shop | Example Ceramics                 |
 |    https://example-ceramics.com/shop                         |
 |    [Language: en] [Canonical: same page] [Robots: ...]       |
 +--------------------------------------------------------------+
 [ 2 Errors ] [ 5 Warnings ] [ 3 Trackers ] [ 142 Links ] [ 38 Images ]
 +-------------------------- Issues (first 4) ------ See all 7 -+
 +--- SEO ---------------+ +--- Tracking -----------+
 +--- Social preview ----+ +--- Heading outline ----+
 +--- Links -------------+ +--- Images -------------+
 +--- Screenshot --------+ +--- Comments -----------+
```

- Tiles are at least 280px wide and fill the width: 1 column under about 600px, 2 at the default 640px, more on a wider window. Site, summary and Issues span the full width.
- **Site**: first letter of the host as a badge, title (or "No title"), address, chips for language, canonical (same page / other page / none), robots content (or "Robots: not set").
- **Summary**: errors, warnings, trackers, links (the same number as the Links tab), images. Numbers count up when a check arrives. Errors and warnings are tinted only when above zero.
- **Issues**: up to 4, "See all N" opens Page info. None: "No issues found."
- **SEO**: title and description length bars against 60 and 160 (description below 50 is short), counts of H1, headings, hreflang. H1 count other than 1 is shown as a problem.
- **Tracking**: each tracker with its IDs, "loaded N times" when a script repeats; chips for UTM links, UTM problems, mixed content, unsafe `_blank`.
- **Social preview**: the og:image (or the first featured image) as a share card with host, title and description. Images load only from web addresses, as everywhere else.
- **Heading outline**: the first 6 headings, indented by level, "+ N more".
- **Links**: a bar and counts of same site, other sites and other kinds (mailto, tel...), over the links the Links tab shows, each address once; plus hidden and duplicate counts.
- **Images**: first 7 thumbnails, "+N".
- **Screenshot**: the taken picture, top part, or "No picture yet" with **Take screenshot** (same action as the tab).
- **Comments**: Hyvor Talk found or not, with its website and page ids.
- The Highlight search covers the dashboard too.

Motion: tiles rise in one after another when a check arrives, bars fill, numbers count up, clickable tiles lift on hover with an accent edge. All motion is off under "reduce motion".

## How it works

- `src/renderer/page-info/page-dashboard.ts`: pure helpers, tested: `linkBreakdown(links, pageUrl)`, `headingCounts`, `lengthState(length, min, max)`, `canonicalState(url, canonical)`, `hostOf(url)`, `outline(headings, max)`.
- `src/renderer/page-info/PageDashboard.tsx`: the tiles. Gets the report, the shown links, the link count and an `onOpen(tab)` callback; reads the screenshot from the store.
- `src/renderer/page-info/use-count-up.ts`: animates a number, returns it immediately when motion is reduced.
- `PageInfoWindow.tsx`: `TABS` gets `dashboard` first, default tab.
- `page-info.css`: dashboard styles and motion.

## Tests

- `page-dashboard.test.ts`: link breakdown (same site with and without `www.`, other sites, other kinds, duplicates, hidden), heading counts, length states, canonical states, outline limit.

## Not in this version

- Reordering or hiding tiles.
- Comparing two checks.
