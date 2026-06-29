'use client';

import React from 'react';
import { Hash, Heading2, Text } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeaderEditorTarget } from '@/lib/header-assembly/types';

const TARGETS: {
  id: HeaderEditorTarget;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: 'number', label: 'Number', description: 'Puzzle number badge', icon: Hash },
  { id: 'title', label: 'Title', description: 'Main puzzle title bar', icon: Heading2 },
  { id: 'subtitle', label: 'Subtitle', description: 'Fun fact / subtitle bar', icon: Text },
];

export function HeaderTargetPicker({
  selected,
  onSelect,
}: {
  selected: HeaderEditorTarget;
  onSelect: (target: HeaderEditorTarget) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {TARGETS.map((target) => {
          const Icon = target.icon;
          const active = selected === target.id;
          return (
            <button
              key={target.id}
              type="button"
              aria-label={target.label}
              aria-pressed={active}
              title={`${target.label} — ${target.description}`}
              onClick={() => onSelect(target.id)}
              className={cn('gp-icon-toggle', active && 'gp-icon-toggle--active')}
            >
              <Icon strokeWidth={2.25} />
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight text-center">
        {TARGETS.find((t) => t.id === selected)?.description}
      </p>
    </div>
  );
}
