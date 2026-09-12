'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CanvasContextualControlsProps } from '@/components/CanvasContextualControls';
import type { CrosswordContextualControlsProps } from '@/components/CrosswordContextualControls';
import type { GenericPuzzleContextualControlsProps } from '@/components/GenericPuzzleContextualControls';
import type { TextPageEditTarget } from '@/components/TextPageContextualControls';
import type { ResolvedTocEntry } from '@/lib/book-compiler';

export type CanvasEditPanelProps = Omit<CanvasContextualControlsProps, 'variant'>;
export type CrosswordEditPanelProps = Omit<CrosswordContextualControlsProps, 'variant'>;
export type GenericPuzzleEditPanelProps = Omit<GenericPuzzleContextualControlsProps, 'variant'>;

function tocEntriesFingerprint(entries: ResolvedTocEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${entry.documentId}\0${entry.bookPageIndex}\0${entry.level}\0${entry.title}\0${entry.pageNumber ?? ''}`
    )
    .join('|');
}

interface CanvasEditPanelContextValue {
  panelProps: CanvasEditPanelProps | null;
  setPanelProps: (props: CanvasEditPanelProps | null) => void;
  crosswordPanelProps: CrosswordEditPanelProps | null;
  setCrosswordPanelProps: (props: CrosswordEditPanelProps | null) => void;
  genericPuzzlePanelProps: GenericPuzzleEditPanelProps | null;
  setGenericPuzzlePanelProps: (props: GenericPuzzleEditPanelProps | null) => void;
  selectedTextBlockId: string | null;
  textPageEditTarget: TextPageEditTarget;
  textPageBlockChromeVisible: boolean;
  tocEntries: ResolvedTocEntry[];
  selectTextBlock: (blockId: string, options?: { showChrome?: boolean }) => void;
  changeTextPageEditTarget: (target: TextPageEditTarget) => void;
  hideTextBlockChrome: () => void;
  setTextPageBlockChromeVisible: (visible: boolean) => void;
  setTocEntries: (entries: ResolvedTocEntry[]) => void;
}

const CanvasEditPanelContext = createContext<CanvasEditPanelContextValue | null>(null);

const EMPTY_TOC_ENTRIES: ResolvedTocEntry[] = [];

export function CanvasEditPanelProvider({ children }: { children: React.ReactNode }) {
  const [panelProps, setPanelPropsState] = useState<CanvasEditPanelProps | null>(null);
  const [crosswordPanelProps, setCrosswordPanelPropsState] =
    useState<CrosswordEditPanelProps | null>(null);
  const [genericPuzzlePanelProps, setGenericPuzzlePanelPropsState] =
    useState<GenericPuzzleEditPanelProps | null>(null);
  const [selectedTextBlockId, setSelectedTextBlockId] = useState<string | null>(null);
  const [textPageEditTarget, setTextPageEditTarget] =
    useState<TextPageEditTarget>('page-elements');
  const [textPageBlockChromeVisible, setTextPageBlockChromeVisible] = useState(true);
  const [tocEntries, setTocEntriesState] = useState<ResolvedTocEntry[]>(EMPTY_TOC_ENTRIES);

  const setPanelProps = useCallback((props: CanvasEditPanelProps | null) => {
    setPanelPropsState(props);
  }, []);

  const setCrosswordPanelProps = useCallback((props: CrosswordEditPanelProps | null) => {
    setCrosswordPanelPropsState(props);
  }, []);

  const setGenericPuzzlePanelProps = useCallback((props: GenericPuzzleEditPanelProps | null) => {
    setGenericPuzzlePanelPropsState(props);
  }, []);

  const selectTextBlock = useCallback((blockId: string, options?: { showChrome?: boolean }) => {
    setSelectedTextBlockId(blockId || null);
    setTextPageBlockChromeVisible(options?.showChrome !== false);
    setTextPageEditTarget('page-elements');
  }, []);

  const changeTextPageEditTarget = useCallback((target: TextPageEditTarget) => {
    setTextPageEditTarget(target);
    setTextPageBlockChromeVisible(false);
  }, []);

  const hideTextBlockChrome = useCallback(() => {
    setTextPageBlockChromeVisible(false);
  }, []);

  const setTocEntries = useCallback((entries: ResolvedTocEntry[]) => {
    setTocEntriesState((prev) => {
      const next = entries.length === 0 ? EMPTY_TOC_ENTRIES : entries;
      if (prev === next) return prev;
      if (tocEntriesFingerprint(prev) === tocEntriesFingerprint(next)) return prev;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      panelProps,
      setPanelProps,
      crosswordPanelProps,
      setCrosswordPanelProps,
      genericPuzzlePanelProps,
      setGenericPuzzlePanelProps,
      selectedTextBlockId,
      textPageEditTarget,
      textPageBlockChromeVisible,
      tocEntries,
      selectTextBlock,
      changeTextPageEditTarget,
      hideTextBlockChrome,
      setTextPageBlockChromeVisible,
      setTocEntries,
    }),
    [
      panelProps,
      setPanelProps,
      crosswordPanelProps,
      setCrosswordPanelProps,
      genericPuzzlePanelProps,
      setGenericPuzzlePanelProps,
      selectedTextBlockId,
      textPageEditTarget,
      textPageBlockChromeVisible,
      tocEntries,
      selectTextBlock,
      changeTextPageEditTarget,
      hideTextBlockChrome,
      setTocEntries,
    ]
  );

  return (
    <CanvasEditPanelContext.Provider value={value}>{children}</CanvasEditPanelContext.Provider>
  );
}

export function useCanvasEditPanel(): CanvasEditPanelContextValue {
  const ctx = useContext(CanvasEditPanelContext);
  if (!ctx) {
    return {
      panelProps: null,
      setPanelProps: () => {},
      crosswordPanelProps: null,
      setCrosswordPanelProps: () => {},
      genericPuzzlePanelProps: null,
      setGenericPuzzlePanelProps: () => {},
      selectedTextBlockId: null,
      textPageEditTarget: 'page-elements',
      textPageBlockChromeVisible: true,
      tocEntries: EMPTY_TOC_ENTRIES,
      selectTextBlock: () => {},
      changeTextPageEditTarget: () => {},
      hideTextBlockChrome: () => {},
      setTextPageBlockChromeVisible: () => {},
      setTocEntries: () => {},
    };
  }
  return ctx;
}
