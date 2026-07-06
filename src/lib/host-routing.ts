/** Hostnames that serve the puzzle editor (rewritten to /app/*). */
export const APP_SUBDOMAIN_HOSTS = new Set([
  'app.genpuzzle.com',
  'app.localhost',
]);

/** Hostnames that serve the marketing site (rewritten to /marketing/*). */
export const MARKETING_HOSTS = new Set([
  'genpuzzle.com',
  'www.genpuzzle.com',
  'localhost',
  '127.0.0.1',
]);

export function normalizeHostname(hostHeader: string | null): string {
  if (!hostHeader) return '';
  return hostHeader.split(':')[0].toLowerCase();
}

export function isAppSubdomainHost(hostname: string): boolean {
  return APP_SUBDOMAIN_HOSTS.has(hostname);
}

export function isMarketingHost(hostname: string): boolean {
  return MARKETING_HOSTS.has(hostname);
}

export const APP_ORIGIN = 'https://app.genpuzzle.com';
export const MARKETING_ORIGIN = 'https://genpuzzle.com';

export function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Public URL for links to the puzzle app (same host in local dev). */
export function resolveAppPublicHref(hostname: string): string {
  if (isLocalDevHost(hostname)) {
    return '/app';
  }
  return APP_ORIGIN;
}

/** Public URL for links to the marketing site (same host in local dev). */
export function resolveMarketingPublicHref(hostname: string): string {
  if (isLocalDevHost(hostname)) {
    return '/';
  }
  return MARKETING_ORIGIN;
}

/** Build internal path for app routes from a public pathname. */
export function toAppInternalPath(pathname: string): string {
  if (pathname.startsWith('/app')) return pathname;
  return pathname === '/' ? '/app' : `/app${pathname}`;
}

/** Build internal path for marketing routes from a public pathname. */
export function toMarketingInternalPath(pathname: string): string {
  if (pathname.startsWith('/marketing')) return pathname;
  return pathname === '/' ? '/marketing' : `/marketing${pathname}`;
}
