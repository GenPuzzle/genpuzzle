'use client';

import { motion } from 'framer-motion';
import { PUZZLE_TYPES } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';

export function StatusBar() {
  return (
    <section className="border-y border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-max items-center gap-3 sm:gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Puzzle types</span>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {PUZZLE_TYPES.map((puzzle, i) => (
            <motion.div
              key={puzzle.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -2, scale: 1.04 }}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: puzzle.accent }}
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {puzzle.name}
              </span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  puzzle.status === 'live'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {puzzle.status === 'live' ? 'Live' : 'Soon'}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
