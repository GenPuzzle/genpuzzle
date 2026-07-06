'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Wand2 } from 'lucide-react';
import { fadeUp } from '@/components/marketing/landing/BookMockup';

export function BeforeAfterSection() {
  return (
    <section className="bg-white py-20 dark:bg-slate-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.p variants={fadeUp} custom={0} className="text-sm font-bold uppercase tracking-wider text-[#2276b4]">
            The magic transformation
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            From boring grid to beautiful book
          </motion.h2>
        </motion.div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Before</p>
            <p className="mt-1 text-lg font-semibold text-slate-600 dark:text-slate-300">Plain spreadsheet grid</p>
            <div className="mt-4 grid grid-cols-10 gap-px rounded-lg border border-slate-200 bg-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800">
              {Array.from({ length: 100 }).map((_, i) => (
                <span
                  key={i}
                  className="flex aspect-square items-center justify-center bg-white text-[8px] text-slate-400 dark:bg-slate-900"
                >
                  {String.fromCharCode(65 + (i % 26))}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-500">No branding, no layout, not print-ready.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-2xl border border-[#2276b4]/30 bg-gradient-to-br from-[#0a1628] to-[#1a5a8c] p-6 text-white shadow-xl"
          >
            <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold">
              <Wand2 className="h-3 w-3" />
              GenPuzzle
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-200">After</p>
            <p className="mt-1 text-lg font-semibold">Professional KDP-ready page</p>
            <div className="mt-4 rounded-xl bg-white p-4 shadow-2xl">
              <p className="text-center text-sm font-bold text-[#1a5a8c]">Ocean Adventures</p>
              <div className="mx-auto mt-3 grid w-fit grid-cols-8 gap-[2px] rounded border border-slate-200 p-2">
                {Array.from({ length: 64 }).map((_, i) => (
                  <span key={i} className="flex h-4 w-4 items-center justify-center text-[7px] font-bold text-slate-700">
                    {String.fromCharCode(65 + (i % 26))}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex justify-center gap-1">
                {['WAVE', 'CORAL', 'FISH'].map((w) => (
                  <span key={w} className="rounded bg-slate-100 px-1.5 py-0.5 text-[7px] font-semibold text-slate-600">
                    {w}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1 text-sm text-blue-100">
              Styled, numbered, export-ready
              <ArrowRight className="h-4 w-4" />
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
