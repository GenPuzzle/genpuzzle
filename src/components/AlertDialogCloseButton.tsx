'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertDialogCloseButtonProps {
  onClick?: () => void;
  label?: string;
  variant?: 'default' | 'onDark';
  className?: string;
}

export function AlertDialogCloseButton({
  onClick,
  label = 'Close',
  variant = 'default',
  className,
}: AlertDialogCloseButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'gp-alert-close',
        variant === 'onDark' && 'gp-alert-close--on-dark',
        className
      )}
      aria-label={label}
      onClick={onClick}
    >
      <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
