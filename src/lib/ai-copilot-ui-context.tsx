'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AgentSelectedElement } from '@/lib/ai/agent-executor';

interface AiCopilotUiValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openCopilot: () => void;
  closeCopilot: () => void;
  selectedElements: AgentSelectedElement[];
  setSelectedElements: (elements: AgentSelectedElement[]) => void;
}

const AiCopilotUiContext = createContext<AiCopilotUiValue | null>(null);

export function AiCopilotUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<AgentSelectedElement[]>([]);

  const openCopilot = useCallback(() => setOpen(true), []);
  const closeCopilot = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openCopilot,
      closeCopilot,
      selectedElements,
      setSelectedElements,
    }),
    [open, openCopilot, closeCopilot, selectedElements]
  );

  return <AiCopilotUiContext.Provider value={value}>{children}</AiCopilotUiContext.Provider>;
}

export function useAiCopilotUi(): AiCopilotUiValue {
  const ctx = useContext(AiCopilotUiContext);
  if (!ctx) {
    throw new Error('useAiCopilotUi must be used within AiCopilotUiProvider');
  }
  return ctx;
}

/** Optional hook when the provider may be absent (e.g. isolated previews). */
export function useOptionalAiCopilotUi(): AiCopilotUiValue | null {
  return useContext(AiCopilotUiContext);
}
