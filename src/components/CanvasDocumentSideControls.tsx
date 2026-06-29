'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CanvasDocumentInsertButton } from '@/components/CanvasDocumentInsertButton';
import { DocumentModuleType } from '@/lib/document-model';
import { cn } from '@/lib/utils';

interface CanvasDocumentSideControlsProps {
  side: 'left' | 'right';
  referenceId: string;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onInsert: (type: DocumentModuleType, position: 'before' | 'after', referenceId: string) => void;
  documentLabel?: string;
}

function NavArrowButton({
  direction,
  disabled,
  onClick,
  title,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  title: string;
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200',
        'w-12 h-12 md:w-14 md:h-14',
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : 'hover:border-[var(--gp-blue)] hover:bg-[var(--gp-grey-50)] hover:text-[var(--gp-blue)] hover:shadow-md active:scale-95'
      )}
    >
      <Icon className="w-6 h-6 md:w-7 md:h-7 stroke-[2]" />
    </button>
  );
}

export function CanvasDocumentSideControls({
  side,
  referenceId,
  canNavigatePrev,
  canNavigateNext,
  onNavigatePrev,
  onNavigateNext,
  onInsert,
  documentLabel,
}: CanvasDocumentSideControlsProps) {
  if (side === 'left') {
    return (
      <div className="flex flex-col items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <NavArrowButton
            direction="prev"
            disabled={!canNavigatePrev}
            onClick={onNavigatePrev}
            title="Previous document"
          />
          <CanvasDocumentInsertButton
            side="before"
            referenceId={referenceId}
            onInsert={onInsert}
          />
        </div>
        {documentLabel && (
          <span className="text-[10px] font-medium text-slate-500 text-center max-w-[120px] leading-tight">
            {documentLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <CanvasDocumentInsertButton
          side="after"
          referenceId={referenceId}
          onInsert={onInsert}
        />
        <NavArrowButton
          direction="next"
          disabled={!canNavigateNext}
          onClick={onNavigateNext}
          title="Next document"
        />
      </div>
    </div>
  );
}
