import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The development extension's id, pinned by its manifest `key`
// (web/extension/dev-key/). Read at build time so the page can message it.
function devExtensionId(): string {
  try {
    return readFileSync(new URL('../extension/dev-key/extension-id.txt', import.meta.url), 'utf8').trim();
  } catch {
    return 'pkddffeebcmhhanjcigilehaeonkkfih';
  }
}

function downloadsHeadersPlugin() {
  return {
    name: 'downloads-headers',
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/downloads/') && req.url.includes('.zip')) {
          const isFirefox = req.url.includes('firefox');
          const cleanName = isFirefox ? 'raaga-extension-firefox.zip' : 'raaga-extension-chrome.zip';
          res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
          res.setHeader('Content-Type', 'application/zip');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), downloadsHeadersPlugin()],
  define: {
    DEV_EXTENSION_ID: JSON.stringify(devExtensionId()),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom', 'react-router', 'react-dom/client'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@tanstack/react-query',
    ],
  },
  server: {
    // The extension's externally_connectable and DNR rules name this origin
    // exactly, so the port must not drift to 5174 when 5173 is busy.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/jiosaavn': {
        target: 'https://www.jiosaavn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jiosaavn/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36',
          'Cookie': 'explicit_content=1',
        },
      },
    },
  },
});
