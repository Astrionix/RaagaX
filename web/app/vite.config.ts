import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The development extension's id, pinned by its manifest `key`
// (web/extension/dev-key/). Read at build time so the page can message it.
function devExtensionId(): string {
  try {
    return readFileSync(new URL('../extension/dev-key/extension-id.txt', import.meta.url), 'utf8').trim();
  } catch {
    return '';
  }
}

// The party server's address: .env.local here, a Cloudflare Pages variable in production,
// or falling back to the primary Render cluster if unset.
function ensurePartyServer(mode: string): void {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  if (!env.VITE_PARTY_SERVER_URL?.trim() && !process.env.VITE_PARTY_SERVER_URL?.trim()) {
    process.env.VITE_PARTY_SERVER_URL = 'https://raagax.onrender.com';
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') ensurePartyServer(mode);
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'addon-proxy-middleware',
        configureServer(server) {
          const proxyHandler = async (req: any, res: any, next: any) => {
            if (!req.url) return next();

            // 1. JSON API Proxy for Add-on Manifest and Search
            if (req.url.startsWith('/api/addon-proxy')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
              res.setHeader('Access-Control-Allow-Headers', '*');

              if (req.method === 'OPTIONS') {
                res.statusCode = 204;
                res.end();
                return;
              }

              const parsedUrl = new URL(req.url, 'http://localhost:5173');
              const target = parsedUrl.searchParams.get('url');
              if (!target) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing url query parameter' }));
                return;
              }

              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 12000);
                const fetchRes = await fetch(target, {
                  method: req.method || 'GET',
                  headers: {
                    Accept: 'application/json, text/plain, */*',
                    'User-Agent': 'Raaga-Web-AddonProxy/1.0',
                  },
                  signal: controller.signal,
                });
                clearTimeout(timeout);

                res.statusCode = fetchRes.status;
                fetchRes.headers.forEach((val, key) => {
                  const lKey = key.toLowerCase();
                  if (!['access-control-allow-origin', 'content-encoding', 'content-length'].includes(lKey)) {
                    res.setHeader(key, val);
                  }
                });
                res.setHeader('Access-Control-Allow-Origin', '*');

                const arrayBuffer = await fetchRes.arrayBuffer();
                res.end(Buffer.from(arrayBuffer));
              } catch (err: any) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Addon proxy request failed: ${err?.message || String(err)}` }));
              }
              return;
            }

            // 2. Audio Stream Proxy with Range support for FLAC/MP3 streaming
            if (req.url.startsWith('/api/addon-stream-proxy')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
              res.setHeader('Access-Control-Allow-Headers', '*');

              if (req.method === 'OPTIONS') {
                res.statusCode = 204;
                res.end();
                return;
              }

              const parsedUrl = new URL(req.url, 'http://localhost:5173');
              const target = parsedUrl.searchParams.get('url');
              if (!target) {
                res.statusCode = 400;
                res.end('Missing url query parameter');
                return;
              }

              try {
                const headers: Record<string, string> = {
                  'User-Agent': 'Raaga-Web-AudioProxy/1.0',
                };
                if (req.headers.range) {
                  headers['Range'] = req.headers.range as string;
                }

                const fetchRes = await fetch(target, {
                  method: req.method || 'GET',
                  headers,
                });

                res.statusCode = fetchRes.status;
                fetchRes.headers.forEach((val, key) => {
                  const lKey = key.toLowerCase();
                  if (!['access-control-allow-origin'].includes(lKey)) {
                    res.setHeader(key, val);
                  }
                });
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Accept-Ranges', 'bytes');

                if (fetchRes.body) {
                  const reader = fetchRes.body.getReader();
                  const pump = async () => {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) {
                        res.end();
                        break;
                      }
                      res.write(value);
                    }
                  };
                  await pump();
                } else {
                  res.end();
                }
              } catch (err: any) {
                res.statusCode = 502;
                res.end(`Audio stream proxy failed: ${err?.message || String(err)}`);
              }
              return;
            }

            next();
          };

          server.middlewares.use(proxyHandler);
        },
      },
      {
        name: 'serve-downloads-with-headers',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/downloads/')) {
              const parsedUrl = new URL(req.url, 'http://localhost');
              const pathname = decodeURIComponent(parsedUrl.pathname);
              const filename = pathname.replace('/downloads/', '');
              if (filename && filename.endsWith('.zip')) {
                const filePath = fileURLToPath(new URL(`./public/downloads/${filename}`, import.meta.url));
                if (existsSync(filePath)) {
                  const stat = statSync(filePath);
                  res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-Length': stat.size,
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Expose-Headers': 'Content-Disposition',
                  });
                  createReadStream(filePath).pipe(res);
                  return;
                }
              }
            }
            next();
          });
        },
      },
    ],
    define: {
      DEV_EXTENSION_ID: JSON.stringify(devExtensionId()),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      dedupe: ['react', 'react-dom'],
    },
    // AutoMix's analysis worker (playback/automix): essentia.js's 2021-era
    // Emscripten glue breaks under dep pre-bundling, and the worker is a module.
    optimizeDeps: { exclude: ['essentia.js'] },
    worker: { format: 'es' },
    server: {
      // The extension's externally_connectable and DNR rules name this origin
      // exactly, so the port must not drift to 5174 when 5173 is busy.
      port: 5173,
      strictPort: true,
      proxy: {
        '/api/parties': {
          target: 'https://raagax.onrender.com',
          changeOrigin: true,
          secure: true,
        },
        '/api/time': {
          target: 'https://raagax.onrender.com',
          changeOrigin: true,
          secure: true,
        },
        '/ws/parties': {
          target: 'https://raagax.onrender.com',
          changeOrigin: true,
          secure: true,
          ws: true,
        },
      },
    },
  };
});
