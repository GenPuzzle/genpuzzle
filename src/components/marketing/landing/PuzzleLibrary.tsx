'use client';

import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { PUZZLE_TYPES } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';

function PuzzleCard({
  puzzle,
  appHref,
}: {
  puzzle: (typeof PUZZLE_TYPES)[number];
  appHref: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 });

  const href = puzzle.status === 'live' ? appHref : '#puzzles';

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      whileHover={{ scale: 1.02 }}
      className="group relative flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:w-[280px]"
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${puzzle.accent}, transparent)` }}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ background: puzzle.accent }}
        >
          {puzzle.name.charAt(0)}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
            puzzle.status === 'live'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          )}
        >
          {puzzle.status === 'live' ? 'Explore' : 'Coming Soon'}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{puzzle.name}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-500 dark:text-slate-400">{puzzle.description}</p>
      <p className="mt-4 text-sm font-semibold text-[#2276b4] opacity-0 transition-opacity group-hover:opacity-100">
        {puzzle.status === 'live' ? 'Open in editor →' : 'Notify me when live →'}
      </p>
    </motion.a>
  );
}

interface PuzzleLibraryProps {
  appHref: string;
}

export function PuzzleLibrary({ appHref }: PuzzleLibraryProps) {
  return (
    <section id="puzzles" className="bg-slate-50 py-20 dark:bg-slate-900/50 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <p className="text-sm font-bold uppercase tracking-wider text-[#2276b4]">Puzzle library</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            One platform, every puzzle type
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Word Search is live today. Crosswords, Sudoku, Mazes, and more are on the roadmap — hover
            to explore.
          </p>
        </motion.div>

        <div className="mt-10 -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-thin sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {PUZZLE_TYPES.map((puzzle) => (
            <PuzzleCard key={puzzle.id} puzzle={puzzle} appHref={appHref} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href={appHref}
            className="text-sm font-bold text-[#2276b4] hover:underline"
          >
            Start with Word Search →
          </Link>
        </div>
      </div>
    </section>
  );
}
