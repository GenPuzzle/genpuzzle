'use client';

import React, { useEffect, useRef } from 'react';
import { Type } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toggle at the top of document settings.
 * Auto-balance font size so text stays inside the safe margins and above
 * the page number when it is enabled. Font sliders stay editable.
 */
export function AutoGridAndFontControl({
  fontEnabled,
  onFontEnabledChange,
  apply,
  applyKey,
  enabledHint,
  disabledHint,
}: {
  fontEnabled: boolean;
  onFontEnabledChange: (next: boolean) => void;
  apply: () => void;
  /** Changes when page size / grid dimensions / margins change — not when fonts change. */
  applyKey: string;
  enabledHint?: string;
  disabledHint?: string;
}) {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!fontEnabled) return;
    applyRef.current();
  }, [fontEnabled, applyKey]);

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-800 dark:bg-sky-950/40">
      <button
        type="button"
        onClick={() => onFontEnabledChange(!fontEnabled)}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold transition-colors',
          fontEnabled
            ? 'bg-sky-600 text-white shadow-sm hover:bg-sky-700'
            : 'bg-white text-sky-800 ring-1 ring-sky-300 hover:bg-sky-100 dark:bg-slate-800 dark:text-sky-100 dark:ring-sky-700'
        )}
        aria-pressed={fontEnabled}
      >
        <Type className="h-3.5 w-3.5 shrink-0" />
        Auto-balance font size
      </button>
      <p className="mt-2 text-[11px] leading-snug text-sky-900/80 dark:text-sky-200/80">
        {fontEnabled
          ? enabledHint ??
            'On: fonts stay inside the safe margins and above the page number when it is enabled. You can still adjust font sizes manually.'
          : disabledHint ??
            'Turn on to fit fonts so nothing crosses the safe margin or the page number. You can still edit font sizes after that.'}
      </p>
    </div>
  );
}
