'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { BookOpen, Layers, Presentation, Sparkles, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppServicesMenu() {
  const pathname = usePathname();
  const onPuzzleBooks = pathname === '/app' || pathname === '/app/';
  const onImageToPpt = pathname.startsWith('/app/other-tools/image-to-ppt');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <HeaderExpandButton
          expandSize="md"
          label="Services"
          icon={<Layers className="h-3.5 w-3.5" strokeWidth={2.25} />}
          aria-label="Services menu"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem asChild className={cn('cursor-pointer', onPuzzleBooks && 'bg-accent')}>
          <Link href="/app">
            <BookOpen className="h-4 w-4" />
            Puzzle Books
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="opacity-60">
          <Sparkles className="h-4 w-4" />
          <span className="flex flex-1 items-center justify-between gap-2">
            Story book
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Coming soon
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={cn(onImageToPpt && 'bg-accent')}>
            <Wrench className="h-4 w-4" />
            Other Tools
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuItem asChild className={cn('cursor-pointer', onImageToPpt && 'bg-accent')}>
              <Link href="/app/other-tools/image-to-ppt">
                <Presentation className="h-4 w-4" />
                Image to Editable PPT
              </Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
