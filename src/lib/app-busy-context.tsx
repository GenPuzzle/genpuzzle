'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export type AppBusyState = {
  active: boolean;
  label: string;
  /** 0–100 when known; omit for indeterminate top bar */
  progress?: number;
};

type AppBusyContextValue = {
  busy: AppBusyState;
  showBusy: (label: string, progress?: number) => void;
  updateBusy: (patch: Partial<Pick<AppBusyState, 'label' | 'progress'>>) => void;
  hideBusy: () => void;
  /** Run async work under the busy overlay; always clears when finished. */
  withBusy: <T>(label: string, work: () => Promise<T> | T) => Promise<T>;
};

const DEFAULT_BUSY: AppBusyState = { active: false, label: '' };

const AppBusyContext = createContext<AppBusyContextValue | null>(null);

export function AppBusyProvider({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState<AppBusyState>(DEFAULT_BUSY);
  const depthRef = useRef(0);

  const showBusy = useCallback((label: string, progress?: number) => {
    depthRef.current += 1;
    setBusy({
      active: true,
      label,
      progress: typeof progress === 'number' ? progress : undefined,
    });
  }, []);

  const updateBusy = useCallback(
    (patch: Partial<Pick<AppBusyState, 'label' | 'progress'>>) => {
      setBusy((prev) => (prev.active ? { ...prev, ...patch } : prev));
    },
    []
  );

  const hideBusy = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) {
      setBusy(DEFAULT_BUSY);
    }
  }, []);

  const withBusy = useCallback(
    async <T,>(label: string, work: () => Promise<T> | T): Promise<T> => {
      showBusy(label);
      try {
        return await work();
      } finally {
        hideBusy();
      }
    },
    [showBusy, hideBusy]
  );

  const value = useMemo(
    () => ({ busy, showBusy, updateBusy, hideBusy, withBusy }),
    [busy, showBusy, updateBusy, hideBusy, withBusy]
  );

  return <AppBusyContext.Provider value={value}>{children}</AppBusyContext.Provider>;
}

export function useAppBusy(): AppBusyContextValue {
  const ctx = useContext(AppBusyContext);
  if (!ctx) {
    throw new Error('useAppBusy must be used within AppBusyProvider');
  }
  return ctx;
}

/** Safe for optional use outside provider (no-ops). */
export function useOptionalAppBusy(): AppBusyContextValue {
  const ctx = useContext(AppBusyContext);
  if (ctx) return ctx;
  return {
    busy: DEFAULT_BUSY,
    showBusy: () => {},
    updateBusy: () => {},
    hideBusy: () => {},
    withBusy: async (_label, work) => work(),
  };
}
