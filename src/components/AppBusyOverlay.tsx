'use client';

import { useOptionalAppBusy } from '@/lib/app-busy-context';
import '@/components/app-busy-overlay.css';

/**
 * Global charging bar + card while long actions run
 * (export PDF/PPT/GP, open/save, all-pages / 3D preview, generate, …).
 */
export function AppBusyOverlay() {
  const { busy } = useOptionalAppBusy();
  if (!busy.active) return null;

  const hasPct = typeof busy.progress === 'number' && Number.isFinite(busy.progress);
  const pct = hasPct ? Math.max(0, Math.min(100, busy.progress as number)) : undefined;

  return (
    <div className="app-busy-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="app-busy-overlay__top-bar" aria-hidden>
        <div
          className={
            pct === undefined
              ? 'app-busy-overlay__bar app-busy-overlay__bar--indeterminate'
              : 'app-busy-overlay__bar'
          }
          style={pct === undefined ? undefined : { width: `${pct}%` }}
        />
      </div>
      <div className="app-busy-overlay__scrim">
        <div className="app-busy-overlay__card">
          <div className="app-busy-overlay__spinner" aria-hidden />
          <p className="app-busy-overlay__label">{busy.label || 'Working…'}</p>
          <div className="app-busy-overlay__track" aria-hidden>
            <div
              className={
                pct === undefined
                  ? 'app-busy-overlay__fill app-busy-overlay__fill--indeterminate'
                  : 'app-busy-overlay__fill'
              }
              style={pct === undefined ? undefined : { width: `${pct}%` }}
            />
          </div>
          {pct !== undefined && <p className="app-busy-overlay__pct">{Math.round(pct)}%</p>}
        </div>
      </div>
    </div>
  );
}
