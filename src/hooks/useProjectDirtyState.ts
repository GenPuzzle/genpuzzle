'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseProjectDirtyStateOptions {
  /** True once app settings have been hydrated. */
  active: boolean;
  /** Serialized project state — must change when any tracked field changes. */
  stateSignature: string;
}

export function useProjectDirtyState({ active, stateSignature }: UseProjectDirtyStateOptions) {
  const [isProjectDirty, setIsProjectDirty] = useState(false);
  const [captureTick, setCaptureTick] = useState(0);

  const baselineRef = useRef<string | null>(null);
  const trackingEnabledRef = useRef(false);
  const suppressRef = useRef(false);
  const pendingCaptureRef = useRef(false);
  const stateSignatureRef = useRef(stateSignature);

  stateSignatureRef.current = stateSignature;

  const captureBaseline = useCallback(() => {
    baselineRef.current = stateSignatureRef.current;
    setIsProjectDirty(false);
  }, []);

  const markProjectSaved = useCallback(() => {
    captureBaseline();
  }, [captureBaseline]);

  const scheduleBaselineCapture = useCallback(() => {
    pendingCaptureRef.current = true;
    setCaptureTick((tick) => tick + 1);
  }, []);

  const beginSuppressDirty = useCallback(() => {
    suppressRef.current = true;
  }, []);

  const endSuppressDirty = useCallback(() => {
    suppressRef.current = false;
  }, []);

  // 1 — initial baseline after hydration
  useEffect(() => {
    if (!active) return;

    const frame = requestAnimationFrame(() => {
      trackingEnabledRef.current = true;
      baselineRef.current = stateSignatureRef.current;
      setIsProjectDirty(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [active]);

  // 2 — baseline after open / new project
  useEffect(() => {
    if (!active || !pendingCaptureRef.current) return;
    pendingCaptureRef.current = false;
    baselineRef.current = stateSignatureRef.current;
    setIsProjectDirty(false);
  }, [active, captureTick]);

  // 3 — dirty flag
  useEffect(() => {
    if (!active || !trackingEnabledRef.current || suppressRef.current) return;

    const baseline = baselineRef.current;
    if (!baseline) return;

    setIsProjectDirty(stateSignature !== baseline);
  }, [active, stateSignature]);

  return {
    isProjectDirty,
    markProjectSaved,
    scheduleBaselineCapture,
    beginSuppressDirty,
    endSuppressDirty,
  };
}
