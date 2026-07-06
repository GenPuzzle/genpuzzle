import { headers } from 'next/headers';
import { normalizeHostname, resolveAppPublicHref } from '@/lib/host-routing';
import { MarketingLanding } from '@/components/marketing/MarketingLanding';

export default async function MarketingHomePage() {
  const host = (await headers()).get('host');
  const appHref = resolveAppPublicHref(normalizeHostname(host));

  return <MarketingLanding appHref={appHref} />;
}
