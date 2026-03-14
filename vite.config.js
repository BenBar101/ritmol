import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// GitHub Pages: set VITE_BASE_PATH to your repo name with slashes, e.g. /my-repo/
// Leave unset for local dev or custom domain (defaults to /).
const base = process.env.VITE_BASE_PATH || '/';
const CACHE_VERSION = `v${Date.now()}`;

export default defineConfig({
  base,
  define: {
    "self.__RITMOL_CACHE_VERSION__": JSON.stringify(CACHE_VERSION),
  },
  plugins: [
    react(),
    {
      name: 'sw-cache-version',
      closeBundle() {
        const swPath = resolve(__dirname, 'sw.js');
        const outPath = resolve(__dirname, 'dist', 'sw.js');
        const content = readFileSync(swPath, 'utf-8')
          .replace(/self\.__RITMOL_CACHE_VERSION__\s*\|\|\s*"v__BUILD_HASH__"/, JSON.stringify(CACHE_VERSION));
        writeFileSync(outPath, content);
      },
    },
    {
      name: 'html-base',
      transformIndexHtml(html) {
        const baseTag = base !== '/' ? `<base href="${base}">` : '';
        return baseTag ? html.replace(/<head>/, `<head>${baseTag}`) : html;
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: { manualChunks: undefined }
    }
  }
});
