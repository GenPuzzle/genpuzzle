'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { BookOpen, Layers, Sparkles } from 'lucide-react';

export function AppServicesMenu() {
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
        <DropdownMenuItem className="cursor-pointer">
          <BookOpen className="h-4 w-4" />
          Puzzle Books
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
