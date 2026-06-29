'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from './useDebouncedCallback';

export interface UsePersistedStateOptions<T> {
  /** Debounce delay before writing to localStorage (default 300ms). */
  debounceMs?: number;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  /** Merge stored value with initial defaults (handles schema upgrades). */
  merge?: (stored: T, initial: T) => T;
  /** Sync updates from other browser tabs via the storage event. */
  crossTab?: boolean;
}

function defaultSerialize<T>(value: T): string {
  return JSON.stringify(value);
}

function defaultDeserialize<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function readStorage<T>(
  key: string,
  initialValue: T,
  deserialize: (raw: string) => T,
  merge?: (stored: T, initial: T) => T
): T {
  if (typeof window === 'undefined') return initialValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return initialValue;
    const parsed = deserialize(raw);
    return merge ? merge(parsed, initialValue) : parsed;
  } catch (e) {
    console.warn(`[usePersistedState] Failed to read "${key}":`, e);
    return initialValue;
  }
}

function writeStorage<T>(key: string, value: T, serialize: (value: T) => string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, serialize(value));
  } catch (e) {
    console.warn(`[usePersistedState] Failed to write "${key}":`, e);
  }
}

/**
 * React state synced to localStorage with debounced writes and optional cross-tab sync.
 *
 * @returns [value, setValue, isHydrated]
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  options: UsePersistedStateOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const {
    debounceMs = 300,
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
    merge,
    crossTab = true,
  } = options;

  const initialRef = useRef(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<T>(initialValue);
  const stateRef = useRef(state);
  stateRef.current = state;

  const persist = useDebouncedCallback((value: T) => {
    writeStorage(key, value, serialize);
  }, debounceMs);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    const loaded = readStorage(key, initialRef.current, deserialize, merge);
    setState(loaded);
    setIsHydrated(true);
  }, [key, deserialize, merge]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  // Cross-tab sync
  useEffect(() => {
    if (!crossTab || typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return;
      try {
        const parsed = deserialize(event.newValue);
        const next = merge ? merge(parsed, initialRef.current) : parsed;
        setState(next);
      } catch (e) {
        console.warn(`[usePersistedState] Cross-tab sync failed for "${key}":`, e);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, crossTab, deserialize, merge]);

  return [state, setValue, isHydrated];
}
