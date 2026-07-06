'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { MARKETING_NAV } from '@/lib/marketing/content';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

interface LandingNavProps {
  appHref: string;
}

export function LandingNav({ appHref }: LandingNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a1628]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image
            src="/genpuzzle-icon-white.svg"
            alt="GenPuzzle"
            width={32}
            height={32}
            className="h-8 w-8"
            unoptimized
          />
          <span className="text-lg font-bold tracking-tight text-white">GenPuzzle</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {MARKETING_NAV.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle variant="marketing" />
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link
              href={appHref}
              className="hidden items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#0a1628] shadow-lg shadow-black/20 transition hover:bg-blue-50 sm:inline-flex"
            >
              Open app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
          <button
            type="button"
            className="marketing-nav__menu-btn inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10 md:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {MARKETING_NAV.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href={appHref}
                className={cn(
                  'mt-2 flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-[#0a1628]'
                )}
                onClick={() => setOpen(false)}
              >
                Open app
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
