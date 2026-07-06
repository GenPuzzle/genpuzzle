'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface MarketingHeaderActionsProps {
  appHref: string;
}

export function MarketingHeaderActions({ appHref }: MarketingHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <ThemeToggle variant="marketing" />
      <Link
        href={appHref}
        className="inline-flex items-center rounded-lg bg-[var(--gp-blue)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--gp-blue-dark)] sm:px-4"
      >
        Open app
      </Link>
    </div>
  );
}
