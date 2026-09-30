import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Admin route: block search engine indexing via X-Robots-Tag ───────────
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }

  // ─── API routes: CORS preflight ────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, X-Api-Version');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, X-Api-Version');

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/admin'],
};
