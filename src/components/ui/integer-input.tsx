'use client';

import React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Integer text box for discrete counts (puzzles, starting #, clues, grid size).
 * Clamps only on blur/Enter so multi-digit values can be typed freely.
 */
export function IntegerInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  id,
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  className?: string;
  id?: string;
}) {
  const [localValue, setLocalValue] = React.useState(String(value ?? ''));
  const isFocused = React.useRef(false);

  const commitValue = React.useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const fallback = min ?? 0;
      if (trimmed === '') {
        const next = fallback;
        setLocalValue(String(next));
        onChange(next);
        return;
      }
      let num = parseInt(trimmed, 10);
      if (Number.isNaN(num)) {
        num = fallback;
      }
      if (min !== undefined && num < min) num = min;
      if (max !== undefined && num > max) num = max;
      setLocalValue(String(num));
      onChange(num);
    },
    [min, max, onChange]
  );

  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={localValue}
      className={className}
      onFocus={() => {
        isFocused.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        // Allow empty / digits only while typing; clamp later on blur.
        if (next === '' || /^\d+$/.test(next)) {
          setLocalValue(next);
        }
      }}
      onBlur={(e) => {
        isFocused.current = false;
        commitValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          isFocused.current = false;
          commitValue((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
