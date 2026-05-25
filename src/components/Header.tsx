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
        <div className="relative h-12 w-auto flex-shrink-0">
          <Image
            src="/logo.png?v=1.2"
            alt="GenPuzzle Logo"
            height={48}
            width={48}
            priority
            className="h-12 w-auto object-contain"
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
