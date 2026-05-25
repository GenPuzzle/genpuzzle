'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-200">
      <Link 
        href="/" 
        className="flex items-center gap-3 no-underline text-inherit hover:opacity-80 transition-opacity"
      >
        {/* Next.js Image component with cache busting */}
        <div className="relative h-10 w-auto flex-shrink-0">
          <Image
            src="/genpuzzle-logo.svg?v=1.1"
            alt="GenPuzzle Logo"
            height={40}
            width={50}
            priority
            className="h-10 w-auto object-contain"
            unoptimized={true}
          />
        </div>
        
        {/* Brand text */}
        <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
          GenPuzzle
        </span>
      </Link>
    </header>
  );
}
