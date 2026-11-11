# More ways to open the donut: plan

Spec: `docs/superpowers/specs/2026-11-10-open-triggers-design.md`

1. **Setting.** Add `openKeys` (string, default `Ctrl+Alt+Space`) to `settings.schema.ts`.
2. **Key logic (shared).** `src/shared/open-keys.ts` with `keysFromPress`, `checkKeys`, `formatKeys`. Tests first.
3. **Registering (main).** `src/main/shortcuts/open-keys.ts` with `setOpenKeys(keys, onPress)`. It registers the new keys, puts the old ones back on failure, and throws a UserError. Tests with a mocked `globalShortcut`.
4. **Wiring.** `shortcuts.ts` exports `openPieWithFocus()` and `togglePieFromKeys()`. `settings.ipc.ts` registers keys before saving `openKeys`. `main.ts` applies the saved keys at start.
5. **Right-click menu.** `src/main/shell-menu/shell-menu.ts` with `shellMenuCommands(exe)` and `removeCommands()` (tests), plus `installShellMenu()` and `removeShellMenu()`. `main.ts` installs it when packaged, removes it on `--squirrel-uninstall`, and handles `--open-pie` on start and in `second-instance`.
6. **Settings UI.** A field in `AppearanceSection.tsx` for recording, turning off, and showing errors. Update the header hint.
7. **Docs.** README.
8. Run `npm test`, `npm run typecheck`, and `npm run lint`.
