import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native modules can't be bundled, so they're loaded from node_modules.
      external: ['uiohook-napi', 'better-sqlite3', 'koffi'],
    },
  },
});
