'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="relative flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 border-b border-blue-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-300" style={{background: `linear-gradient(to right, #F0F5F6 0%, #ffffff 100%)`}}>
      {/* Decorative gradient background */}
      <div className="absolute inset-0 -z-10" style={{background: `linear-gradient(to right, rgba(34, 118, 180, 0.05) 0%, rgba(34, 118, 180, 0.02) 100%)`}}></div>
      
      <Link 
        href="/" 
        className="flex items-center gap-3 no-underline text-inherit hover:opacity-90 active:scale-95 transition-all duration-200 group"
      >
        {/* Logo with glow effect on hover */}
        <div className="relative h-12 w-12 flex-shrink-0 group-hover:animate-glow">
          <div className="absolute inset-0 rounded-lg blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300" style={{background: `linear-gradient(to right, #2276B4, #1a5a8c)`}}></div>
          <Image
            src="/genpuzzle-icon.svg"
            alt="GenPuzzle Logo"
            height={48}
            width={48}
            priority
            className="h-12 w-12 object-contain relative drop-shadow-sm"
            unoptimized={true}
          />
        </div>
        
        {/* Brand text with gradient */}
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight" style={{background: `linear-gradient(to right, #2276B4, #1a5a8c)`, WebkitBackgroundClip: `text`, WebkitTextFillColor: `transparent`, backgroundClip: `text`}}>
            GenPuzzle
          </span>
          <span className="text-xs font-medium tracking-wider" style={{color: `#7D8183`}}>Puzzle Generator</span>
        </div>
      </Link>
    </header>
  );
}
