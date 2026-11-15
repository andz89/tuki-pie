import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { withContentSecurityPolicy } from './src/renderer/csp';

const root = path.resolve(import.meta.dirname, 'src/renderer');

// Adds each page's Content-Security-Policy, looser while the dev server runs.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'pie-content-security-policy',
    transformIndexHtml(html, context) {
      return withContentSecurityPolicy(
        html,
        path.basename(context.filename),
        context.server !== undefined,
      );
    },
  };
}

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
        savedSites: path.join(root, 'saved-sites.html'),
        reminder: path.join(root, 'reminder.html'),
      },
    },
  },
  plugins: [react(), contentSecurityPolicy()],
});
