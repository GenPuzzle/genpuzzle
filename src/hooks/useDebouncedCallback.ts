'use client';

import { useCallback, useEffect, useRef } from 'react';

export type DebouncedCallback<T extends (...args: never[]) => void> = T & {
  flush: () => void;
  cancel: () => void;
};

/**
 * Returns a debounced function that can be flushed (run immediately) or cancelled.
 * Pending calls are flushed on unmount so tab switches do not lose in-progress edits.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number
): DebouncedCallback<T> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const argsRef = useRef<Parameters<T> | undefined>(undefined);

  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    argsRef.current = undefined;
  }, []);

  const flush = useCallback(() => {
    if (argsRef.current !== undefined) {
      callbackRef.current(...argsRef.current);
      cancel();
    }
  }, [cancel]);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args;
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
        cancel();
      }, delayMs);
    },
    [delayMs, cancel]
  ) as DebouncedCallback<T>;

  debounced.flush = flush;
  debounced.cancel = cancel;

  useEffect(() => () => flush(), [flush]);

  return debounced;
}
