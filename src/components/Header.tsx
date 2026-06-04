'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="relative flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Decorative gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10"></div>
      
      <Link 
        href="/" 
        className="flex items-center gap-3 no-underline text-inherit hover:opacity-90 active:scale-95 transition-all duration-200 group"
      >
        {/* Logo with glow effect on hover */}
        <div className="relative h-12 w-auto flex-shrink-0 group-hover:animate-glow">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
          <Image
            src="/logo.png?v=1.2"
            alt="GenPuzzle Logo"
            height={48}
            width={48}
            priority
            className="h-12 w-auto object-contain relative drop-shadow-sm"
            unoptimized={true}
          />
        </div>
        
        {/* Brand text with gradient */}
        <div className="flex flex-col">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
            GenPuzzle
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wider">Puzzle Generator</span>
        </div>
      </Link>
    </header>
  );
}
