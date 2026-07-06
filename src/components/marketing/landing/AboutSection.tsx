'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { fadeUp } from '@/components/marketing/landing/BookMockup';

const STEPS = [
  'Add your word list or pick a template',
  'Customize layout, fonts, and page frames live',
  'Compile multi-page books with drag-and-drop tabs',
  'Export KDP-ready PDF or PowerPoint in one click',
];

export function AboutSection() {
  return (
    <section id="about" className="bg-white py-20 dark:bg-slate-950 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.p variants={fadeUp} custom={0} className="text-sm font-bold uppercase tracking-wider text-[#2276b4]">
            About GenPuzzle
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Raw ideas → print-ready KDP books
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="mt-4 text-slate-600 leading-relaxed dark:text-slate-400">
            GenPuzzle is a purpose-built puzzle book studio — not a generic design tool with plugins
            bolted on. Every control maps to real print constraints: trim size, bleed, margins, and
            export specs Amazon KDP expects.
          </motion.p>
          <ul className="mt-8 space-y-3">
            {STEPS.map((step, i) => (
              <motion.li
                key={step}
                variants={fadeUp}
                custom={i + 3}
                className="flex items-start gap-3 text-slate-700 dark:text-slate-300"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <span>{step}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800"
        >
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#38bdf8]/20 blur-2xl" />
          <blockquote className="relative text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            &ldquo;I used to spend days in InDesign lining up grids. With GenPuzzle I had a
            sellable word search book exported the same afternoon.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm font-semibold text-slate-500">— KDP puzzle book creator</p>
        </motion.div>
      </div>
    </section>
  );
}
