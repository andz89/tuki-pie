# Pie Launcher

A desktop app that shows a donut menu for opening apps, folders, and notes.

Ctrl + Shift + click anywhere to open the donut at the mouse. Do it again, press Esc, or click away to close it. Drag it by pressing anywhere on the ring and moving.

Ctrl + Alt + Space does the same from the keyboard. Change the keys or turn them off in Settings, under **Appearance**.

In the installed app you can also right-click the desktop or empty space in a folder and choose **Open Pie Launcher**. On Windows 11 it is under **Show more options**. This entry is not added while running with `npm start`.

Open Settings from the tray icon near the clock to add, change, or reorder shortcuts and snippets and choose the look. Everything is saved on this computer.

The Screenshot slice takes the entire screen under the mouse, or a section you drag out (clicking the slice itself picks a section). The picture is copied to the clipboard and saved in Pictures\Pie Launcher.

The Notes slice opens the Notes window: plain-text notes that save as you type, newest changes first, with search. **Remind me** on a note sets a reminder: In 1 hour, Today 17:00, Tomorrow 9:00, Monday 9:00, or any date and time, once or every day, every weekday or every week. When it is due, a card pops up at the top right of the screen with **Open note**, **Snooze 10 min** and **Done**, without taking the keyboard from what you are doing. Reminders pop up while Pie Launcher runs in the tray; one missed while it was closed pops up when it starts.

The Zip slice packs pictures into a zip. Select images in a File Explorer window, open the donut while that window is in front, and click **Zip**. A box in the middle of the donut asks for the zip's name: type it and press Enter (empty means `Images`), or press Esc to go back. The zip is saved next to the images; a name already taken gets a number (`Holiday (2).zip`), so nothing is replaced. A notice then shows the file when clicked. Only picture files count (jpg, png, gif, webp, bmp, tiff, heic, avif, svg, ico). The slice is greyed out when no images were selected. It reads Explorer windows only, not files selected on the desktop.

The Page Info slice checks a website's title, SEO, tracking tags and more, and shows the results as cards.

The window opens on **Dashboard**: the whole check on one screen (site details, issues, SEO, tracking, social preview, headings, links, images, screenshot and comments). Click a tile's link or a number to open the tab with the details.

Every check runs in Chrome with your logins (**Check in Chrome**). (**Show site**, a browser window inside the app just for looking, is hidden for now.) Checking needs the extension in `packages/pie-extension`, set up once:

1. In Chrome, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick the `packages/pie-extension` folder.
2. In Pie Launcher Settings, open the **Chrome** tab and press **Copy**.
3. Click the extension's icon in Chrome, paste the code, and press **Save**. It shows **Connected**.

Once connected, clicking the Page Info slice checks the active Chrome tab, or a newly copied address when Chrome has no web page open. Without Chrome, nothing is checked.

The page's images (the **Images** tab, the dashboard and the social preview) come through Chrome too, with your logins, so images that need you to be logged in show. Pie Launcher never loads them itself. The list asks Chrome for a small picture as each row scrolls into view, and for the full image only when you click to enlarge it. While Chrome isn't connected, the images say to connect it.

The **Screenshot** tab takes a picture of the whole checked page, top to bottom, as Chrome shows it with your logins. It is taken only when you press **Take screenshot**, as a JPEG. **View as** picks the size first: Desktop (the Chrome tab as it is) or a phone or tablet from Chrome's device list. For a device, the tab turns into that device for a moment (its width, touch, and its own browser name), then goes back. **Reload the page as this device first** helps on sites that only send their mobile version when the page loads; the page then loads twice. Only the tab Page Info opened itself is reloaded: a tab you opened is pictured as it is, so nothing you typed is lost. A device needs Chrome's debugger, so it doesn't work while DevTools is open on the tab. **Save** puts it in Pictures\Pie Launcher, **Copy** puts it on the clipboard. While it is being taken, the Chrome window and tab come to the front for a moment (a minimized window opens, then goes back), because Chrome draws a page behind other windows slowly, and Chrome shows its "started debugging this browser" bar. Page Info comes back to the front afterwards. When Chrome doesn't allow that (DevTools open, or another extension controlling the tab), the page is scrolled and stitched instead, so fixed headers appear only once. A new check clears the picture. After updating the extension, Chrome asks once to allow the new permission.

**History** (the clock in the address row) finds pages you visited in Chrome. Set the days and an address, then press **Search**; nothing loads before that. **Match entire address** (ticked) finds the one page whose address is what you typed, ignoring `https://`, `www.`, case and a trailing slash; unticked, every address that has the text in it. Click a row to check that page in a new tab, or tick rows (or **Select all**) and press **Open selected**. It sees the Chrome profile the extension is in, and needs the extension's `history` permission, so reload the extension once after updating.

The app and the extension talk on `127.0.0.1` port 17361, on this computer only.

## Info Card

The **Info Card** slice opens a card on top of Chrome with page info of the tab you are looking at. Switch tabs and the card follows. The magnifier button opens the page in Web Page for the full check. **Pin** keeps the card open; unpinned, it closes when you click elsewhere. The layout button puts it down the right edge (**Sidebar**), across the **Top** or across the **Bottom**. The list button picks what it shows: title, URL, description and language; canonical; headings; counts; tracking; Hyvor Talk; featured images. Both are remembered. The card is 95% opaque. Click the **links** count to swap the Info Card for the **Links card**: Web Page's Links list for the same page, down the right edge (Hide duplicates, Link filters, search, ticks, Show on page, Copy URL, Open, Open all). A switch at the top, **Open links in: Chrome | Web Page**, decides where every Open and Open all go, and is remembered. The **images** count opens the **Images card** the same way: Web Page's Images list (search, broken count, the full-size viewer with previous and next, Copy URL, Open and Open all in Chrome). The **Highlight** field marks words in the link addresses and, with [mark.js](https://markjs.io/) (MIT, copied into `packages/pie-extension/vendor`), in the page's text in Chrome; emptying it or closing the card clears the marks. The back button returns to the Info Card. It shows only while Chrome is in front: with another app in front, or Chrome minimized or closed, it hides, and comes back with Chrome (Windows only). Unlike Web Page, it reads the tab you are on (any `http` or `https` page), but only while the card is open, and stores nothing. Reload the extension once after updating.

## Suggestions

Values you type often, in named groups ("Day", "Month"). Click an input field, text area or select box on any page in Chrome, also inside iframes, and a list under it offers them under their group names. On a select box, only values that match one of its options show up, by value or by the start of the option text ("06" picks "06-Jun"). Shift+click several fields to fill them all with one value, or use a group's **Fill in order** to fill them top to bottom with that group's values in order. Tab into a field to open the list from the keyboard; Esc closes it.

Add and change them in Settings, under **Suggestions**: add several values at once with commas ("13, 02, 00"), click a group name, value or label to change it (**+ label** adds one), drag groups to reorder them, drag values to reorder them or move them to another group (the label goes along), or hide a value from the list without deleting it. **Show the list on input fields in Chrome** turns it off everywhere, for example while another extension shows its own.

The list needs the Chrome extension above. Chrome keeps a copy, so it still works while Pie Launcher is closed; changes reach Chrome the next time they connect. The list is drawn where the page's own scripts can't read it, and only opens for your own clicks and Tab presses.

After updating Pie Launcher, reload the extension once in `chrome://extensions`, and refresh pages that were already open.

## Commands

| Command             | What it does                |
| ------------------- | --------------------------- |
| `npm start`         | Runs the app                |
| `npm test`          | Runs the unit tests         |
| `npm run typecheck` | Checks the TypeScript types |
| `npm run lint`      | Checks code quality         |
| `npm run package`   | Builds the packaged app     |

While `npm start` is running, click in the terminal and press `R` to restart the app. Press Ctrl + C to stop it.
