'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type CommonProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
};

/**
 * Controlled settings text field with a local draft so typing stays smooth
 * even when parent state updates remount siblings or sync document pages.
 */
export function SettingsTextInput({
  value,
  onChange,
  placeholder,
  className,
  id,
  disabled,
}: CommonProps) {
  const [draft, setDraft] = React.useState(value ?? '');
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value ?? '');
    }
  }, [value]);

  return (
    <Input
      id={id}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChange(next);
      }}
      onBlur={() => {
        focusedRef.current = false;
        const normalized = draft;
        if ((value ?? '') !== normalized) {
          onChange(normalized);
        } else {
          setDraft(value ?? '');
        }
      }}
    />
  );
}

/** Multi-line variant for per-puzzle custom titles, themes, etc. */
export function SettingsTextarea({
  value,
  onChange,
  placeholder,
  className,
  id,
  disabled,
  rows,
}: CommonProps & { rows?: number }) {
  const [draft, setDraft] = React.useState(value ?? '');
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value ?? '');
    }
  }, [value]);

  return (
    <Textarea
      id={id}
      disabled={disabled}
      rows={rows}
      className={cn(className)}
      placeholder={placeholder}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChange(next);
      }}
      onBlur={() => {
        focusedRef.current = false;
        const normalized = draft;
        if ((value ?? '') !== normalized) {
          onChange(normalized);
        } else {
          setDraft(value ?? '');
        }
      }}
    />
  );
}
