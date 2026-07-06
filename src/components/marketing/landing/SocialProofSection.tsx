'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { SOCIAL_PROOF_STATS } from '@/lib/marketing/content';

export function SocialProofSection() {
  return (
    <section className="border-y border-slate-200 bg-[#0a1628] py-16 dark:border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
          <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">Loved by KDP Creators</h2>
          <p className="mt-2 text-slate-400">Trusted by indie publishers building puzzle book businesses</p>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {SOCIAL_PROOF_STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm"
            >
              <p className="text-2xl font-extrabold text-white sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-300">{stat.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stat.hint}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
