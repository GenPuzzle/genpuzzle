import Image from 'next/image';
import Link from 'next/link';
import { APP_ORIGIN } from '@/lib/host-routing';

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#f0f5f6] via-white to-[#e8f1f8]">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/genpuzzle-icon.svg"
            alt="GenPuzzle"
            width={36}
            height={36}
            className="h-9 w-9"
            unoptimized
          />
          <span className="text-lg font-semibold text-slate-900">GenPuzzle</span>
        </div>
        <Link
          href={APP_ORIGIN}
          className="inline-flex items-center rounded-lg bg-[var(--gp-blue)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--gp-blue-dark)]"
        >
          Open app
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/genpuzzle-icon.svg"
          alt=""
          width={72}
          height={72}
          className="mb-6 h-[72px] w-[72px]"
          unoptimized
          aria-hidden
        />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Build beautiful puzzle books faster
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
          GenPuzzle helps you design word searches, layout pages, and export print-ready PDF and
          PowerPoint books for Amazon KDP and beyond.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={APP_ORIGIN}
            className="inline-flex items-center rounded-xl bg-[var(--gp-blue)] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--gp-blue-dark)]"
          >
            Launch puzzle maker
          </Link>
          <a
            href="mailto:support@genpuzzle.com"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-[var(--gp-blue)] hover:text-[var(--gp-blue)]"
          >
            Contact us
          </a>
        </div>
      </main>

      <footer className="border-t border-slate-200 px-6 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} GenPuzzle. All rights reserved.
      </footer>
    </div>
  );
}
