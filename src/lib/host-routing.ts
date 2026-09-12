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

const PRIVATE_LAN_IPV4 =
  /^(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

export function normalizeHostname(hostHeader: string | null): string {
  if (!hostHeader) return '';
  return hostHeader.split(':')[0].toLowerCase();
}

export function isAppSubdomainHost(hostname: string): boolean {
  return APP_SUBDOMAIN_HOSTS.has(hostname);
}

/** True for localhost and private LAN IPs (phone ↔ PC on the same Wi‑Fi). */
export function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    PRIVATE_LAN_IPV4.test(hostname)
  );
}

export function isMarketingHost(hostname: string): boolean {
  return MARKETING_HOSTS.has(hostname) || isLocalDevHost(hostname);
}

export const APP_ORIGIN = 'https://app.genpuzzle.com';
export const MARKETING_ORIGIN = 'https://genpuzzle.com';

/** Public URL for links to the puzzle app (same host in local / LAN dev). */
export function resolveAppPublicHref(hostname: string): string {
  if (isLocalDevHost(hostname)) {
    return '/app';
  }
  return APP_ORIGIN;
}

/** Public URL for links to the marketing site (same host in local / LAN dev). */
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
