/**
 * Raaga Admin Dashboard — Cloudflare Worker
 * Serves the real-time Supabase telemetry dashboard directly on your custom domain.
 */

// If deploying with Wrangler with html bundling:
import htmlContent from './index.html';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Return the Admin Dashboard HTML
    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
