'use client';

import { motion } from 'framer-motion';
import { Layout, FileDown, Layers, BookOpen, Sparkles } from 'lucide-react';
import { BENTO_FEATURES } from '@/lib/marketing/content';
import { fadeUp } from '@/components/marketing/landing/BookMockup';
import { cn } from '@/lib/utils';

const icons = {
  canvas: Layout,
  pages: Layers,
  export: FileDown,
  templates: Sparkles,
  flipbook: BookOpen,
} as const;

export function BentoFeatures() {
  return (
    <section id="features" className="bg-slate-50 py-20 dark:bg-slate-900/50 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.p variants={fadeUp} custom={0} className="text-sm font-bold uppercase tracking-wider text-[#2276b4]">
            Interactive features
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Everything you need to ship a book
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="mt-3 text-slate-600 dark:text-slate-400">
            A design-first workflow built for puzzle publishers — not generic document editors.
          </motion.p>
        </motion.div>

        <div className="mt-14 grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENTO_FEATURES.map((feature, i) => {
            const Icon = icons[feature.id as keyof typeof icons] ?? Layout;
            return (
              <motion.article
                key={feature.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900',
                  feature.size === 'large' && 'sm:col-span-2 lg:row-span-2',
                  feature.size === 'medium' && 'lg:col-span-2'
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 opacity-[0.07] transition-opacity group-hover:opacity-[0.12] bg-gradient-to-br',
                    feature.gradient
                  )}
                />
                <div className="relative">
                  <div className={cn('inline-flex rounded-xl bg-gradient-to-br p-2.5 text-white shadow-lg', feature.gradient)}>
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
