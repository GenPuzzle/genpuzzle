import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  APP_ORIGIN,
  MARKETING_ORIGIN,
  isAppSubdomainHost,
  isMarketingHost,
  normalizeHostname,
  toAppInternalPath,
  toMarketingInternalPath,
} from '@/lib/host-routing';

function withIframeHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'ALLOWALL');
  response.headers.set('Content-Security-Policy', 'frame-ancestors *');
  return response;
}

export function middleware(request: NextRequest) {
  const hostname = normalizeHostname(request.headers.get('host'));
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // Already on an internal route — guard cross-site access.
  if (pathname.startsWith('/app') || pathname.startsWith('/marketing')) {
    if (isMarketingHost(hostname) && pathname.startsWith('/app')) {
      const publicPath = pathname.replace(/^\/app/, '') || '/';
      return NextResponse.redirect(new URL(publicPath, APP_ORIGIN));
    }
    if (isAppSubdomainHost(hostname) && pathname.startsWith('/marketing')) {
      const publicPath = pathname.replace(/^\/marketing/, '') || '/';
      return NextResponse.redirect(new URL(publicPath, MARKETING_ORIGIN));
    }
    return withIframeHeaders(NextResponse.next());
  }

  // app.genpuzzle.com → /app/*
  if (isAppSubdomainHost(hostname)) {
    url.pathname = toAppInternalPath(pathname);
    return withIframeHeaders(NextResponse.rewrite(url));
  }

  // genpuzzle.com (and local dev) → /marketing/*
  if (isMarketingHost(hostname)) {
    url.pathname = toMarketingInternalPath(pathname);
    return withIframeHeaders(NextResponse.rewrite(url));
  }

  return withIframeHeaders(NextResponse.next());
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
};
