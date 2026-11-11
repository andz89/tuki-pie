import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname, 'src/renderer');

// The renderer lives in src/renderer, but its build output must stay where
// Electron Forge expects it, and where the window files load it from.
export default defineConfig({
  root,
  build: {
    outDir: path.resolve(import.meta.dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        donut: path.join(root, 'index.html'),
        panel: path.join(root, 'panel.html'),
        pageInfo: path.join(root, 'page-info.html'),
        screenshot: path.join(root, 'screenshot.html'),
        notes: path.join(root, 'notes.html'),
        reminder: path.join(root, 'reminder.html'),
      },
    },
  },
  plugins: [react()],
});
