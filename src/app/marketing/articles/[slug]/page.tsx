import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { normalizeHostname, resolveAppPublicHref } from '@/lib/host-routing';
import { getArticleBySlug, formatArticleDate } from '@/lib/marketing/content';
import { LandingNav } from '@/components/marketing/landing/LandingNav';
import { LandingFooter } from '@/components/marketing/landing/LandingFooter';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function MarketingArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const host = (await headers()).get('host');
  const appHref = resolveAppPublicHref(normalizeHostname(host));

  return (
    <div className="min-h-screen bg-white font-sans dark:bg-slate-950">
      <LandingNav appHref={appHref} />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/#articles" className="text-sm font-semibold text-[#2276b4] hover:underline">
          ← Back to articles
        </Link>
        <div
          className="mt-6 h-40 rounded-2xl"
          style={{ background: article.coverGradient }}
        />
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {article.category} · {formatArticleDate(article.publishedAt)} · {article.readMinutes} min read
        </p>
        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
          <p className="text-lg text-slate-600 dark:text-slate-300">{article.excerpt}</p>
          <p>
            This article preview is a placeholder while we connect GenPuzzle to our content
            database. Check back soon for the full guide with screenshots, export settings, and
            step-by-step publishing workflows.
          </p>
        </div>
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Full article content will be loaded from the database in a future update.
        </div>
      </article>
      <LandingFooter appHref={appHref} />
    </div>
  );
}
