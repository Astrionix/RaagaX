import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { queryClient } from '@/lib/queryClient';
import { routes } from '@/routes';
import '@/styles/global.css';
// Handle stale chunk loading errors when new versions are deployed
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const reloadKey = 'raaga:vite_preload_reload';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 15000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  });
}

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
