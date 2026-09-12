/** Parse export status strings like "Building slide 3 of 10…" into a 0–100 progress. */
export function progressFromStatus(status: string): number | undefined {
  const ofMatch = status.match(/(\d+)\s+of\s+(\d+)/i);
  if (ofMatch) {
    const current = Number(ofMatch[1]);
    const total = Number(ofMatch[2]);
    if (total > 0 && Number.isFinite(current)) {
      // Reserve the last ~8% for packing / download.
      return Math.max(4, Math.min(92, Math.round((current / total) * 88) + 4));
    }
  }
  if (/preparing|loading/i.test(status)) return 6;
  if (/rendering/i.test(status)) return 12;
  if (/generating|writing|pack/i.test(status)) return 94;
  if (/download/i.test(status)) return 98;
  return undefined;
}

/**
 * Soft ramp while an async task has no real progress callbacks.
 * Returns a stop function that jumps to 100%.
 */
export function startSoftProgress(
  update: (progress: number) => void,
  opts?: { start?: number; cap?: number; stepMs?: number; step?: number }
): () => void {
  const start = opts?.start ?? 8;
  const cap = opts?.cap ?? 90;
  const stepMs = opts?.stepMs ?? 120;
  const step = opts?.step ?? 4;
  let value = start;
  update(value);
  const id = window.setInterval(() => {
    value = Math.min(cap, value + step);
    update(value);
    if (value >= cap) window.clearInterval(id);
  }, stepMs);
  return () => {
    window.clearInterval(id);
    update(100);
  };
}
