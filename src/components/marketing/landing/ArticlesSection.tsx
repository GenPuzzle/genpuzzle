'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LATEST_ARTICLES, formatArticleDate } from '@/lib/marketing/content';

export function ArticlesSection() {
  return (
    <section id="articles" className="bg-white py-20 dark:bg-slate-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-bold uppercase tracking-wider text-[#2276b4]">Latest articles</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Publishing guides & tips
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Expert advice for KDP puzzle book creators. Full articles coming from our database soon.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LATEST_ARTICLES.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <Link
                href={`/articles/${article.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#2276b4]/40 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-32" style={{ background: article.coverGradient }} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <span>{article.category}</span>
                    <span>{article.readMinutes} min</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 group-hover:text-[#2276b4] dark:text-white">
                    {article.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{article.excerpt}</p>
                  <p className="mt-4 text-xs font-semibold text-[#2276b4]">
                    Read more · {formatArticleDate(article.publishedAt)}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
