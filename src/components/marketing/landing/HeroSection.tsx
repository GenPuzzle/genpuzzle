'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { BookMockup, fadeUp } from '@/components/marketing/landing/BookMockup';

interface HeroSectionProps {
  appHref: string;
}

export function HeroSection({ appHref }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-[#0a1628] pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pb-32"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#2276b4]/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#38bdf8]/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-blue-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Built for Amazon KDP creators
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]"
          >
            Publish Your Puzzle Books in{' '}
            <span className="bg-gradient-to-r from-[#7dd3fc] to-[#38bdf8] bg-clip-text text-transparent">
              Minutes, Not Days
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg"
          >
            GenPuzzle turns raw word lists into print-ready puzzle books. Design live, manage pages
            like a pro, and export KDP-ready PDFs — no InDesign headaches.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href={appHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#38bdf8] to-[#2276b4] px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-[#2276b4]/30 sm:w-auto"
              >
                Start Designing for Free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <a
                href="#templates"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 sm:w-auto"
              >
                Browse templates
              </a>
            </motion.div>
          </motion.div>

          <motion.p variants={fadeUp} custom={4} className="mt-4 text-sm text-slate-500">
            No credit card required · Word Search live now · More puzzle types coming soon
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <BookMockup />
        </motion.div>
      </div>
    </section>
  );
}
