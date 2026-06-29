'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ALL_DOCUMENT_MODULES,
  DocumentModuleType,
  FRONT_MATTER_MODULES,
  PUZZLE_MODULES,
} from '@/lib/document-model';
import { cn } from '@/lib/utils';

interface CanvasDocumentInsertButtonProps {
  side: 'before' | 'after';
  referenceId: string;
  onInsert: (type: DocumentModuleType, position: 'before' | 'after', referenceId: string) => void;
  className?: string;
  variant?: 'canvas' | 'tab';
}

export function CanvasDocumentInsertButton({
  side,
  referenceId,
  onInsert,
  className,
  variant = 'canvas',
}: CanvasDocumentInsertButtonProps) {
  const label = side === 'before' ? 'Add page before' : 'Add page after';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            variant === 'canvas' &&
              'flex shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-100/90 text-slate-400 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-white hover:text-slate-600 hover:shadow-md active:scale-95 w-14 h-14 md:w-16 md:h-16',
            variant === 'tab' && 'doc-tabs-add',
            className
          )}
        >
          {variant === 'tab' ? (
            <span className="doc-tabs-add__label" aria-hidden>
              +
            </span>
          ) : (
            <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[1.5]" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === 'tab' ? 'start' : side === 'before' ? 'end' : 'start'}
        className="w-52"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Front Matter</DropdownMenuLabel>
        {FRONT_MATTER_MODULES.map((module) => (
          <DropdownMenuItem
            key={module.type}
            onClick={() => onInsert(module.type, side, referenceId)}
          >
            {module.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Puzzle Sections</DropdownMenuLabel>
        {PUZZLE_MODULES.map((module) => (
          <DropdownMenuItem
            key={module.type}
            onClick={() => onInsert(module.type, side, referenceId)}
          >
            {module.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Flat list variant for mobile compact menu */
export const DOCUMENT_MODULE_OPTIONS = ALL_DOCUMENT_MODULES;
