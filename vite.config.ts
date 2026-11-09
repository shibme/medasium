import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Relative base so the site works from any GitHub Pages path.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-sqljs-wasm',
      buildStart() {
        mkdirSync('public/vendor', { recursive: true });
        copyFileSync('node_modules/sql.js/dist/sql-wasm-browser.wasm', 'public/vendor/sql-wasm-browser.wasm');
      },
    },
  ],
  build: { chunkSizeWarningLimit: 800 },
  test: { environment: 'node' },
});
