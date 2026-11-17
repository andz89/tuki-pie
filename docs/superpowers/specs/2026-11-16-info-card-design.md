# Info Card: design

Date: 2026-11-16

Builds on `2026-11-09-page-info-design.md` and `2026-11-12-images-from-chrome-design.md`.

## What we are building

A new slice in the pie, **Info Card**. Picking it opens a small card that shows page info for the tab you are looking at in Chrome. Switch Chrome tabs and the card changes to the new tab.

Decisions taken with the user:

- The card is a Pie Launcher window that floats on top of Chrome. Chrome's pages are not changed.
- Three layouts: **Sidebar** (right edge of the screen, full height), **Top** (a bar across the top), **Bottom** (a bar across the bottom).
- **Pin** keeps the card open. Unpinned, the card closes when you click anywhere else. Either way it follows the active tab.
- The user picks which info the card shows, from:
  - Title, URL, description and language (one tick); Canonical (its own tick)
  - Headings (H1 count and the H1 text)
  - Counts (links, images, issues found)
  - Tracking (trackers found, UTM-tagged links)
  - Hyvor Talk (found or not, with its attributes)
  - Featured images (og:image and similar)
- The card is 95% opaque, so the page under it shows through a little.
- The card shows only while Chrome is in front. Another app in front, Chrome minimized or closed: the card hides, and comes back (without taking focus) when Chrome is in front again. Focus moving to Pie Launcher itself (the card, the pie, Web Page) leaves it shown. Main asks Windows every 200 ms which process owns the window in front (`front-app.ts`, through koffi: `chrome.exe`, Pie Launcher, or other); a change counts once seen twice, so Alt+Tab does not make the card blink. The extension is not involved, so this works with any extension version, and while Chrome's worker sleeps.
- Layout and the chosen info are remembered. Pin is not: the card always opens unpinned.

## What the user sees

Sidebar:

```
+------------------- screen -------------------+
|  Chrome                         | Info Card  |
|                                 | (web)(pin)(lay)(fields)(x)
|                                 | Shop - Home|
|                                 | shop.de/   |
|                                 | desc ...   |
|                                 | H1: 1      |
|                                 | 42 links   |
|                                 | GA4, GTM   |
|                                 | [og image] |
+----------------------------------------------+
```

Top (Bottom is the same bar at the bottom):

```
+------------------- screen -------------------+
| Shop - Home | shop.de/ | H1: 1 | 42 links | GA4 | [img] (web)(pin)(lay)(fields)(x)
|  Chrome                                      |
+----------------------------------------------+
```

- **Open in Web Page** button (the Web Page magnifier): checks the card's page in full in the Web Page window, in its empty tab or a new one.
- **Layout** button: a small menu, Sidebar / Top / Bottom. The card moves at once.
- **Fields** button: a checklist of the five groups above. Unticked groups are hidden.
- When nothing can be read the card says why: Chrome is not connected; the tab has no web page (new tab, chrome:// pages, the Web Store); reading failed.
- The card sits on the screen where the pie was opened. It covers part of Chrome; it does not push Chrome aside.

## How it works

- **Extension**
  - New action `readActive`: runs `collect-page.js` in the active tab of the last focused Chrome window and returns `{ url, page }`, or `null` for a non-web tab.
  - New event `activeTabChanged`, sent when the active tab changes, the focused Chrome window changes, or the active tab finishes loading or changes address.
  - Version bump; the extension must be reloaded.
- **Main**
  - `info-card-window.ts`: a frameless, always-on-top window placed by layout on the display under the mouse. Closes on blur while unpinned.
  - While the card is open, each `activeTabChanged` (waited 300 ms so Ctrl+Tab through several tabs reads only the last) asks for `readActive`, builds a report with `buildPageReport`, and sends it to the card.
  - Two new settings: `infoCardLayout` (`sidebar` | `top` | `bottom`) and `infoCardFields` (the ticked groups).
  - The card's featured images go through the existing Chrome image fetch.
  - New window role `info-card` in `ipc-access.ts`.
- **Renderer**: `info-card.html`, `InfoCard.tsx` with the three layouts, pin, layout menu and field checklist.
- **Pie**: a ninth ring slice after Web Page, with its own icon.

## Reading the active tab (approved by the owner, 2026-11-17)

The security review (B6) limited the extension to reading only the tabs Pie Launcher opened. This feature has to read the page you are looking at, which can be any site you are logged into. The owner approved this change on 2026-11-17. To keep that small:

- The extension reads only when Pie Launcher asks, and Pie Launcher asks only while the card is open.
- Only `http` and `https` pages are read.
- What is read is the same page info Web Page already collects; nothing is stored.

## Not included

- Docking that reserves screen space (Chrome resizing to make room).
- A left sidebar.
- Remembering pin across restarts.
