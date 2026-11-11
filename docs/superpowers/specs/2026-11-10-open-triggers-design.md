# More ways to open the donut: design

Date: 2026-11-10

## What we are building

Two new ways to open the donut, next to Ctrl + Shift + click:

1. A **keyboard shortcut** that opens the donut at the mouse in any app. It starts as Ctrl + Alt + Space and can be changed or turned off in Settings.
2. An **Open Pie Launcher** entry in the Windows right-click menu of the desktop and of empty space in Explorer folders.

Decisions taken with the user:

- No tray menu item.
- The shortcut can be changed in Settings.
- The right-click entry is fine sitting under "Show more options" on Windows 11.

## What the user sees

### Keyboard shortcut

- Pressing the keys opens the donut at the mouse. Pressing them again while it is open closes it, like Ctrl + Shift + click.
- Settings, Appearance tab, new first field:

```
Open the donut with
[ Ctrl + Alt + Space ]  [Change]  [Turn off]
```

- **Change** turns the box into "Press the new keys… (Esc to cancel)". The next key combination is saved.
- A combination needs Ctrl, Alt or Win, plus one other key. F1 to F24 may be used alone or with any modifier. Shift plus a letter alone is refused, because it would block typing capitals: "Add Ctrl, Alt or Win to the keys."
- When another app already holds the keys: "Those keys are already used by another app. Try others." The old shortcut stays.
- **Turn off** removes it. The box then shows "Off" and the button reads **Set keys**.
- The header hint mentions the shortcut: "Ctrl + Shift + click anywhere, or press Ctrl + Alt + Space, to open the donut."

### Right-click menu

- Right-click on the desktop or on empty space in a folder: **Open Pie Launcher** with the app icon. On Windows 11 it is under **Show more options**.
- Choosing it opens the donut at the mouse. If the app is not running, it starts and then opens the donut.
- The entry is written each time the packaged app starts, so it always points at the current install. It is removed when the app is uninstalled.
- During `npm start` nothing is written to the registry.

## How it works

- Setting `openKeys`: an Electron accelerator such as `Ctrl+Alt+Space`, or `''` for off. Default `Ctrl+Alt+Space`.
- `src/shared/open-keys.ts`: turns a key press into an accelerator (by physical key, so it does not depend on the keyboard layout), checks it, and formats it for display (`Ctrl + Alt + Space`).
- `src/main/shortcuts/open-keys.ts`: registers the keys with `globalShortcut`. A new combination is registered before it is saved. If registering fails, the old one is put back and a UserError is shown.
- `src/main/shell-menu/shell-menu.ts`: writes and removes the registry keys with `reg.exe` under `HKCU\Software\Classes\DesktopBackground\Shell\PieLauncher` and `HKCU\Software\Classes\Directory\Background\Shell\PieLauncher`. The command is `"<Pie Launcher.exe>" --open-pie`, pointing at Squirrel's stable launcher outside the versioned `app-x.y.z` folder.
- `second-instance` with `--open-pie` opens the donut. Without it, Settings opens as before. A first start with `--open-pie` opens the donut once ready.
- Opening from a shortcut or the menu uses the same F24 trick as Ctrl + Shift + click, so Windows lets the donut take focus.
