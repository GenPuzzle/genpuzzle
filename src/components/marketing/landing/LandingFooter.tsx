'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { MARKETING_NAV } from '@/lib/marketing/content';

interface LandingFooterProps {
  appHref: string;
}

export function LandingFooter({ appHref }: LandingFooterProps) {
  return (
    <footer id="contact" className="bg-[#0a1628] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a5a8c]/40 to-[#0a1628] p-8 text-center sm:p-12"
        >
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Ready to start?</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-400">
            Join creators publishing puzzle books on Amazon KDP. Free to start — export when you&apos;re
            ready.
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="mt-6">
            <Link
              href={appHref}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-[#0a1628] shadow-xl"
            >
              Start Designing for Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </motion.div>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <Image src="/genpuzzle-icon-white.svg" alt="" width={28} height={28} unoptimized aria-hidden />
              <span className="font-bold text-white">GenPuzzle</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              The puzzle book studio for KDP creators. Design, preview, export.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              {MARKETING_NAV.map((item) => (
                <li key={item.id}>
                  <a href={item.href} className="hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Resources</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#articles" className="hover:text-white">
                  Articles
                </a>
              </li>
              <li>
                <a href="#templates" className="hover:text-white">
                  Templates
                </a>
              </li>
              <li>
                <a href="mailto:support@genpuzzle.com" className="hover:text-white">
                  Support
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Legal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <span className="text-slate-600">Privacy (soon)</span>
              </li>
              <li>
                <span className="text-slate-600">Terms (soon)</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} GenPuzzle. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
