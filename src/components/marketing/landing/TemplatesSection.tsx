'use client';

import { motion } from 'framer-motion';
import { MARKETING_TEMPLATES, buildAppTemplateHref } from '@/lib/marketing/content';

interface TemplatesSectionProps {
  appHref: string;
}

export function TemplatesSection({ appHref }: TemplatesSectionProps) {
  return (
    <section id="templates" className="bg-slate-50 py-20 dark:bg-slate-900/50 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-bold uppercase tracking-wider text-[#2276b4]">Templates</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Start from a .gp template
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            One click opens a ready-made layout in the editor. Customize and export.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MARKETING_TEMPLATES.map((template, i) => (
            <motion.a
              key={template.id}
              href={buildAppTemplateHref(appHref, template.id)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="relative h-28 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: template.accent }}
                />
                <div className="absolute left-1/2 top-5 h-16 w-12 -translate-x-1/2 rounded-sm bg-white shadow-lg transition group-hover:-translate-y-1 dark:bg-slate-100" />
                {template.badge && (
                  <span className="absolute right-2 top-2 rounded-full bg-[#0a1628]/80 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                    {template.badge}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-bold text-slate-900 dark:text-white">{template.name}</h3>
                <p className="mt-1 flex-1 text-xs text-slate-500 dark:text-slate-400">{template.description}</p>
                <p className="mt-3 text-xs font-bold text-[#2276b4] opacity-0 transition group-hover:opacity-100">
                  Open in editor →
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
