import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// The Vite plugin normally ships only its own build output. The native modules
// can't be bundled, so they have to ship too, without their source code.
const SHIPPED_FOLDERS = [
  '/node_modules',
  '/node_modules/better-sqlite3',
  '/node_modules/better-sqlite3/prebuilds',
  '/node_modules/koffi',
  '/node_modules/koffi/src',
  '/node_modules/koffi/src/koffi',
  '/node_modules/koffi/src/koffi/src',
  '/node_modules/@koromix',
  '/node_modules/@koromix/koffi-win32-x64',
  '/node_modules/@koromix/koffi-win32-x64/win32_x64',
];
const SHIPPED_PATHS = [
  '/.vite',
  '/node_modules/uiohook-napi',
  '/node_modules/node-gyp-build',
  '/node_modules/better-sqlite3/lib',
  '/node_modules/better-sqlite3/package.json',
  '/node_modules/better-sqlite3/prebuilds/win32-x64.node',
  // koffi, for reading which window is in front (the Zip slice).
  '/node_modules/koffi/package.json',
  '/node_modules/koffi/index.cjs',
  '/node_modules/koffi/src/koffi/index.cjs',
  '/node_modules/koffi/src/koffi/src/static.cjs',
  '/node_modules/koffi/src/koffi/src/trampolines.cjs',
  '/node_modules/@koromix/koffi-win32-x64/package.json',
  '/node_modules/@koromix/koffi-win32-x64/index.js',
  '/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node',
];

function isLeftOutOfPackage(file: string): boolean {
  if (!file || SHIPPED_FOLDERS.includes(file)) {
    return false;
  }
  return !SHIPPED_PATHS.some((shipped) => file.startsWith(shipped));
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ignore: isLeftOutOfPackage,
  },
  // These modules' ready-made binaries work with any Electron version. Rebuilding
  // them would need Visual Studio installed, and would gain nothing.
  rebuildConfig: {
    ignoreModules: ['uiohook-napi', 'better-sqlite3', 'koffi'],
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
        {
          entry: 'src/preload/panel-preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
        {
          entry: 'src/preload/page-info-preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
        {
          entry: 'src/preload/screenshot-preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
        {
          entry: 'src/preload/saved-sites-preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
        {
          entry: 'src/preload/notes-preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
        {
          entry: 'src/preload/reminder-preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
