'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { MARKETING_NAV } from '@/lib/marketing/content';
import { MarketingHeaderActions } from '@/components/marketing/MarketingHeaderActions';
import { cn } from '@/lib/utils';
import './marketing.css';

interface MarketingNavProps {
  appHref: string;
}

export function MarketingNav({ appHref }: MarketingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="marketing-nav">
      <div className="marketing-nav__inner">
        <Link href="/" className="marketing-nav__brand" onClick={() => setMobileOpen(false)}>
          <Image
            src="/genpuzzle-icon.svg"
            alt="GenPuzzle"
            width={32}
            height={32}
            className="h-8 w-8 dark:hidden"
            unoptimized
          />
          <Image
            src="/genpuzzle-icon-white.svg"
            alt=""
            width={32}
            height={32}
            className="hidden h-8 w-8 dark:block"
            unoptimized
            aria-hidden
          />
          <span>GenPuzzle</span>
        </Link>

        <nav className="marketing-nav__links" aria-label="Main">
          {MARKETING_NAV.map((item) => (
            <a key={item.id} href={item.href} className="marketing-nav__link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="marketing-nav__actions">
          <MarketingHeaderActions appHref={appHref} />
          <button
            type="button"
            className="marketing-nav__menu-btn gp-theme-toggle"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="marketing-nav__mobile" aria-label="Mobile">
          {MARKETING_NAV.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="marketing-nav__link"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
