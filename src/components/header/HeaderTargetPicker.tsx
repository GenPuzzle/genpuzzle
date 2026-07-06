'use client';

import React from 'react';
import { Hash, MessageSquare, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeaderEditorTarget } from '@/lib/header-assembly/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const TARGETS: {
  id: HeaderEditorTarget;
  tooltip: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Visible short label beside icon (title control only). */
  inlineLabel?: string;
}[] = [
  { id: 'number', tooltip: 'Puzzle Number', icon: Hash },
  { id: 'title', tooltip: 'Puzzle Title', icon: Type},
  { id: 'subtitle', tooltip: 'Subtitle', icon: MessageSquare },
];

export function HeaderTargetPicker({
  selected,
  onSelect,
}: {
  selected: HeaderEditorTarget;
  onSelect: (target: HeaderEditorTarget) => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-2">
          {TARGETS.map((target) => {
            const Icon = target.icon;
            const active = selected === target.id;
            const labeled = Boolean(target.inlineLabel);
            return (
              <Tooltip key={target.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={target.tooltip}
                    aria-pressed={active}
                    onClick={() => onSelect(target.id)}
                    className={cn(
                      'gp-icon-toggle',
                      labeled && 'gp-icon-toggle--labeled',
                      active && 'gp-icon-toggle--active'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                    {target.inlineLabel && (
                      <span className="gp-icon-toggle__label">{target.inlineLabel}</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  {target.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <p className="text-center text-[10px] leading-tight text-gray-400 dark:text-gray-500">
          {TARGETS.find((t) => t.id === selected)?.tooltip}
        </p>
      </div>
    </TooltipProvider>
  );
}
