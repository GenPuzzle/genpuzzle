'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from './useDebouncedCallback';

export interface UseLiveFieldOptions<T> {
  debounceMs?: number;
  /** Commit immediately on blur (default true). */
  commitOnBlur?: boolean;
  equals?: (a: T, b: T) => boolean;
}

/**
 * Binds a controlled field to global settings with local typing state,
 * debounced commits (300ms), and immediate flush on blur/unmount.
 */
export function useLiveField<T>(
  externalValue: T,
  onCommit: (value: T) => void,
  options: UseLiveFieldOptions<T> = {}
): {
  value: T;
  setValue: (value: T) => void;
  onBlur: () => void;
  onFocus: () => void;
  flush: () => void;
} {
  const { debounceMs = 300, commitOnBlur = true, equals } = options;
  const [localValue, setLocalValue] = useState(externalValue);
  const isFocused = useRef(false);
  const localRef = useRef(localValue);
  localRef.current = localValue;

  const isEqual = equals ?? ((a: T, b: T) => Object.is(a, b));

  useEffect(() => {
    if (!isFocused.current && !isEqual(externalValue, localRef.current)) {
      setLocalValue(externalValue);
    }
  }, [externalValue, isEqual]);

  const debouncedCommit = useDebouncedCallback((value: T) => {
    onCommit(value);
  }, debounceMs);

  const flush = useCallback(() => {
    debouncedCommit.flush();
    if (!isEqual(localRef.current, externalValue)) {
      onCommit(localRef.current);
    }
  }, [debouncedCommit, externalValue, isEqual, onCommit]);

  const setValue = useCallback(
    (value: T) => {
      setLocalValue(value);
      debouncedCommit(value);
    },
    [debouncedCommit]
  );

  const onBlur = useCallback(() => {
    isFocused.current = false;
    if (commitOnBlur) {
      debouncedCommit.cancel();
      onCommit(localRef.current);
    }
  }, [commitOnBlur, debouncedCommit, onCommit]);

  const onFocus = useCallback(() => {
    isFocused.current = true;
  }, []);

  useEffect(() => () => flush(), [flush]);

  return {
    value: localValue,
    setValue,
    onBlur,
    onFocus,
    flush,
  };
}
