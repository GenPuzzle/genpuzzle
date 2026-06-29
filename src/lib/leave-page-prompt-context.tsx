'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useApp } from '@/lib/app-context';
import {
  LeavePageConfirmDialog,
  LEAVE_PAGE_COPY,
  LEAVE_PAGE_MESSAGE,
  SIGN_OUT_COPY,
  type LeavePageConfirmCopy,
} from '@/components/LeavePageConfirmDialog';

export { LEAVE_PAGE_MESSAGE };

export type LeavePromptReason = 'page' | 'sign-out';

export interface LeavePromptOptions {
  reason?: LeavePromptReason;
}

interface LeavePagePromptContextValue {
  promptLeave: (action: () => void, options?: LeavePromptOptions) => void;
  shouldWarnLeave: () => boolean;
}

const LeavePagePromptContext = createContext<LeavePagePromptContextValue | null>(null);

function isReloadShortcut(event: KeyboardEvent): boolean {
  if (event.key === 'F5') return true;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') return true;
  return false;
}

export function LeavePagePromptProvider({ children }: { children: ReactNode }) {
  const { isProjectDirty, settingsHydrated, previewRangeMode, documentPages } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCopy, setDialogCopy] = useState<LeavePageConfirmCopy>(LEAVE_PAGE_COPY);

  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const isProjectDirtyRef = useRef(isProjectDirty);
  const previewRangeModeRef = useRef(previewRangeMode);
  const documentPagesLengthRef = useRef(documentPages.length);
  const dialogOpenRef = useRef(dialogOpen);

  isProjectDirtyRef.current = isProjectDirty;
  previewRangeModeRef.current = previewRangeMode;
  documentPagesLengthRef.current = documentPages.length;
  dialogOpenRef.current = dialogOpen;

  const shouldWarnLeave = useCallback(() => {
    if (!settingsHydrated || allowLeaveRef.current) return false;
    if (documentPagesLengthRef.current === 0) return false;
    return (
      isProjectDirtyRef.current ||
      previewRangeModeRef.current === 'all' ||
      previewRangeModeRef.current === 'flipbook'
    );
  }, [settingsHydrated]);

  const promptLeave = useCallback((action: () => void, options?: LeavePromptOptions) => {
    if (dialogOpenRef.current) return;
    pendingActionRef.current = action;
    setDialogCopy(options?.reason === 'sign-out' ? SIGN_OUT_COPY : LEAVE_PAGE_COPY);
    setDialogOpen(true);
  }, []);

  const handleStay = useCallback(() => {
    pendingActionRef.current = null;
    setDialogOpen(false);
    setDialogCopy(LEAVE_PAGE_COPY);
  }, []);

  const handleLeave = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDialogOpen(false);
    allowLeaveRef.current = true;
    action?.();
  }, []);

  const requestLeave = useCallback(
    (action: () => void, options?: LeavePromptOptions) => {
      if (shouldWarnLeave()) {
        promptLeave(action, options);
        return;
      }
      action();
    },
    [shouldWarnLeave, promptLeave]
  );

  useEffect(() => {
    if (!settingsHydrated) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldWarnLeave() || !isReloadShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      promptLeave(() => {
        window.location.reload();
      });
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [settingsHydrated, shouldWarnLeave, promptLeave]);

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined' || !('navigation' in window)) return;

    const navigation = window.navigation;

    const onNavigate = (event: NavigateEvent) => {
      if (!shouldWarnLeave() || !event.cancelable) return;
      if (event.navigationType !== 'reload') return;

      event.preventDefault();
      promptLeave(() => {
        navigation.reload();
      });
    };

    navigation.addEventListener('navigate', onNavigate);
    return () => navigation.removeEventListener('navigate', onNavigate);
  }, [settingsHydrated, shouldWarnLeave, promptLeave]);

  useEffect(() => {
    if (!settingsHydrated) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnLeave()) return;
      event.preventDefault();
      event.returnValue = LEAVE_PAGE_MESSAGE;
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [settingsHydrated, shouldWarnLeave]);

  const value: LeavePagePromptContextValue = {
    promptLeave: requestLeave,
    shouldWarnLeave,
  };

  return (
    <LeavePagePromptContext.Provider value={value}>
      {children}
      <LeavePageConfirmDialog
        open={dialogOpen}
        copy={dialogCopy}
        onStay={handleStay}
        onLeave={handleLeave}
      />
    </LeavePagePromptContext.Provider>
  );
}

export function useLeavePagePrompt(): LeavePagePromptContextValue {
  const context = useContext(LeavePagePromptContext);
  if (!context) {
    throw new Error('useLeavePagePrompt must be used within LeavePagePromptProvider');
  }
  return context;
}
