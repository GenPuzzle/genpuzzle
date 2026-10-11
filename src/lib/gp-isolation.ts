/**
 * Temporary Crossword freeze isolation flags (A/B tests).
 * Enable via URL: ?gpDiag=1&gpIso=noAnim|cwPlaceholder|skipHistory
 * Multiple: ?gpIso=noAnim,cwPlaceholder
 */

export type GpIsolationFlag = 'noAnim' | 'cwPlaceholder' | 'skipHistory';

const FLAGS: GpIsolationFlag[] = ['noAnim', 'cwPlaceholder', 'skipHistory'];

export function readGpIsolationFlags(): Set<GpIsolationFlag> {
  const out = new Set<GpIsolationFlag>();
  if (typeof window === 'undefined') return out;
  try {
    const raw = new URLSearchParams(window.location.search).get('gpIso') || '';
    for (const part of raw.split(/[,+|]/)) {
      const flag = part.trim() as GpIsolationFlag;
      if (FLAGS.includes(flag)) out.add(flag);
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function hasGpIsolation(flag: GpIsolationFlag): boolean {
  return readGpIsolationFlags().has(flag);
}

declare global {
  interface Window {
    __GP_ISO__?: {
      flags: string[];
      measureSetStateCount: number;
      measureCalls: number;
      bumpMeasure: (setState: boolean) => void;
      resetMeasure: () => void;
    };
  }
}

export function ensureGpIsolationRuntime() {
  if (typeof window === 'undefined') return;
  if (!window.__GP_ISO__) {
    window.__GP_ISO__ = {
      flags: [...readGpIsolationFlags()],
      measureSetStateCount: 0,
      measureCalls: 0,
      bumpMeasure(setState) {
        this.measureCalls += 1;
        if (setState) this.measureSetStateCount += 1;
      },
      resetMeasure() {
        this.measureCalls = 0;
        this.measureSetStateCount = 0;
      },
    };
  } else {
    window.__GP_ISO__.flags = [...readGpIsolationFlags()];
  }
}
