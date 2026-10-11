/**
 * Temporary Crossword freeze diagnostics.
 * Enable with: localStorage.setItem('gp-diag-crossword', '1') then reload.
 * Or ?gpDiag=1 on /app. Logs to console + window.__GP_DIAG__
 */

type DiagEntry = {
  label: string;
  ms: number;
  at: number;
  detail?: string;
};

declare global {
  interface Window {
    __GP_DIAG__?: {
      enabled: boolean;
      entries: DiagEntry[];
      mark: (label: string, ms: number, detail?: string) => void;
      dump: () => DiagEntry[];
    };
  }
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('gpDiag=1')) return true;
    return window.localStorage.getItem('gp-diag-crossword') === '1';
  } catch {
    return false;
  }
}

export function ensureCrosswordDiag() {
  if (typeof window === 'undefined') return;
  if (!window.__GP_DIAG__) {
    window.__GP_DIAG__ = {
      enabled: isEnabled(),
      entries: [],
      mark(label, ms, detail) {
        if (!this.enabled) return;
        const entry = { label, ms, at: performance.now(), detail };
        this.entries.push(entry);
        // Keep last 80
        if (this.entries.length > 80) this.entries.shift();
        const warn = ms >= 16;
        const line = `[gp-diag] ${label}: ${ms.toFixed(1)}ms${detail ? ` — ${detail}` : ''}`;
        if (warn) console.warn(line);
        else console.info(line);
      },
      dump() {
        return [...this.entries];
      },
    };
  } else {
    window.__GP_DIAG__.enabled = isEnabled();
  }
}

export function diagMark(label: string, ms: number, detail?: string) {
  if (typeof window === 'undefined') return;
  ensureCrosswordDiag();
  window.__GP_DIAG__?.mark(label, ms, detail);
}

export function diagTime<T>(label: string, fn: () => T, detail?: string): T {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    return fn();
  } finally {
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    diagMark(label, t1 - t0, detail);
  }
}

export async function diagTimeAsync<T>(
  label: string,
  fn: () => Promise<T>,
  detail?: string
): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    diagMark(label, performance.now() - t0, detail);
  }
}
