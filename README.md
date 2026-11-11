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

Every check runs in Chrome with your logins (**Check in Chrome**). **Show site** opens the same page in a browser window inside the app, just for looking; it never reads the page. Checking needs the extension in `packages/pie-extension`, set up once:

1. In Chrome, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick the `packages/pie-extension` folder.
2. In Pie Launcher Settings, open the **Chrome** tab and press **Copy**.
3. Click the extension's icon in Chrome, paste the code, and press **Save**. It shows **Connected**.

Once connected, clicking the Page Info slice checks the active Chrome tab, or a newly copied address when Chrome has no web page open. Without Chrome, nothing is checked.

The **Screenshot** tab takes a picture of the whole checked page, top to bottom, as Chrome shows it with your logins. It is taken only when you press **Take screenshot**, as a JPEG. **View as** picks the size first: Desktop (the Chrome tab as it is) or a phone or tablet from Chrome's device list. For a device, the tab turns into that device for a moment (its width, touch, and its own browser name), then goes back. **Reload the page as this device first** helps on sites that only send their mobile version when the page loads; the page then loads twice, and anything typed into it is lost. A device needs Chrome's debugger, so it doesn't work while DevTools is open on the tab. **Save** puts it in Pictures\Pie Launcher, **Copy** puts it on the clipboard. While it is being taken, the Chrome tab comes to the front for a moment and Chrome shows its "started debugging this browser" bar. When Chrome doesn't allow that (DevTools open, or another extension controlling the tab), the page is scrolled and stitched instead, so fixed headers appear only once. A new check clears the picture. After updating the extension, Chrome asks once to allow the new permission.

The app and the extension talk on `127.0.0.1` port 17361, on this computer only.

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
