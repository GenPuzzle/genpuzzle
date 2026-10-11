"use client";

import { useZoerIframe } from "@/hooks/useZoerIframe";
import GpIsolationEffects from "@/components/GpIsolationEffects";

export default function GlobalClientEffects() {
  useZoerIframe();
  return <GpIsolationEffects />;
}

