'use client';

/**
 * Crossword settings sidebar — same Layout / Document rail chrome as Word Search
 * and other puzzle documents. Layout panels are book-global; Document panels are
 * for the active crossword tab only.
 */

import React, { useMemo, useState } from 'react';
import { RefreshCw, Zap, Sparkles as LucideSparkles } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useOptionalAppBusy } from '@/lib/app-busy-context';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SETTINGS_TAB_STORAGE_KEY,
  SETTINGS_PANEL_STORAGE_KEY,
  SETTINGS_SIDEBAR_WIDTH_KEY,
} from '@/lib/settings-persistence';
import { cn } from '@/lib/utils';
import {
  normalizeCrosswordSettings,
  getDefaultCrosswordSettings,
  parseCrosswordLines,
} from '@/lib/crossword-settings';
import {
  CrosswordPuzzleSettingsPanel,
  CrosswordWordsSettingsPanel,
  CrosswordTitlesSettingsPanel,
} from '@/components/CrosswordDocumentPanels';
import {
  LayoutBookPanel,
  LayoutColorsPanel,
  LayoutChaptersPanel,
} from '@/components/SharedLayoutPanels';
import { CrosswordContextualControls } from '@/components/CrosswordContextualControls';
import { useCanvasEditPanel } from '@/lib/canvas-edit-panel-context';
import { AiProjectWizard } from '@/components/ai/AiProjectWizard';
import { isAiPuzzleType } from '@/lib/ai/types';

const LAYOUT_TABS = ['book', 'colors', 'pages'] as const;
const DOCUMENT_TABS = ['puzzle', 'words', 'design'] as const;

const PANEL_CLASS =
  'flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2';

function normalizeSettingsPanel(value: string): 'layout' | 'document' {
  if (
    value === 'document' ||
    (DOCUMENT_TABS as readonly string[]).includes(value)
  ) {
    return 'document';
  }
  return 'layout';
}

function normalizeSettingsTab(value: string, panel: 'layout' | 'document'): string {
  if (panel === 'layout') {
    return (LAYOUT_TABS as readonly string[]).includes(value) ? value : 'book';
  }
  if ((LAYOUT_TABS as readonly string[]).includes(value) || value === 'page') {
    return 'puzzle';
  }
  if ((DOCUMENT_TABS as readonly string[]).includes(value)) return value;
  return 'puzzle';
}

function Book({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Grid3X3({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
    </svg>
  );
}
function Type({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7V4H20V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function List({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 12H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 18H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="3" cy="6" r="1.6" fill="currentColor" />
      <circle cx="3" cy="12" r="1.6" fill="currentColor" />
      <circle cx="3" cy="18" r="1.6" fill="currentColor" />
    </svg>
  );
}
function Palette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SIDEBAR_RAIL_CSS = `
  .word-search-sidebar [role="tablist"] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1rem;
    width: 5.25rem;
    padding: 14px 10px 14px 12px;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;
  }
  .word-search-sidebar .sidebar-rail-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 0.4rem;
  }
  .word-search-sidebar .sidebar-rail-heading {
    width: 100%;
    padding: 0 2px;
    text-align: center;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    cursor: pointer;
    transform: none !important;
  }
  .word-search-sidebar .sidebar-rail-heading__title {
    margin: 0;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #64748b;
    line-height: 1.2;
  }
  .word-search-sidebar .sidebar-radio-input {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    border-radius: 0.85rem;
    background: #ffffff;
    color: #0f172a;
    border: 1px solid #d1d5db;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }
  .word-search-sidebar .sidebar-radio-input .sidebar-radio-options {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 4px;
    gap: 2px;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"].modern-tabs-trigger,
  .word-search-sidebar .sidebar-radio-input button[role="tab"] {
    position: relative;
    z-index: 1;
    flex: 0 0 auto !important;
    width: 100% !important;
    height: 4.25rem !important;
    min-height: 4.25rem !important;
    min-width: 0 !important;
    padding: 0.7rem 0.35rem !important;
    border-radius: 0.65rem !important;
    font-weight: 600 !important;
    border: 1px solid transparent !important;
    background: transparent !important;
    color: #334155 !important;
    box-shadow: none !important;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 0.3rem;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
    transform: none !important;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"]:hover {
    background: #f1f5f9 !important;
    color: #1a5a8c !important;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"][data-state="active"] {
    background: #e8eef3 !important;
    color: #1a5a8c !important;
    border-color: #d0dae4 !important;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"][data-state="active"]::before {
    display: none;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"] .tab-subtitle {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.15;
    max-width: 100%;
    color: #475569;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"]:hover .tab-subtitle,
  .word-search-sidebar .sidebar-radio-input button[role="tab"][data-state="active"] .tab-subtitle {
    color: #1a5a8c;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"] svg {
    display: block;
    margin: 0 auto;
    width: 1.55rem !important;
    height: 1.55rem !important;
    stroke-width: 2;
    color: #475569;
    stroke: currentColor;
    fill: none;
  }
  .word-search-sidebar .sidebar-radio-input button[role="tab"]:hover svg,
  .word-search-sidebar .sidebar-radio-input button[role="tab"][data-state="active"] svg {
    color: #1a5a8c !important;
    stroke: #1a5a8c !important;
  }
  .word-search-sidebar .sidebar-generate-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    width: 100%;
    margin-top: 0.15rem;
    padding: 0;
  }
  .word-search-sidebar .sidebar-generate-btn {
    flex: 0;
    width: 100%;
    height: 4.25rem;
    min-height: 4.25rem;
    padding: 0.7rem 0.35rem;
    border-radius: 0.85rem;
    font-weight: 600;
    border: 1px solid #144a75;
    background: #1a5a8c;
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  .word-search-sidebar .sidebar-generate-btn svg {
    width: 1.55rem;
    height: 1.55rem;
    color: #ffffff;
    stroke: #ffffff;
  }
  .word-search-sidebar .sidebar-generate-btn:hover:not(:disabled) {
    background: #144a75;
  }
  .word-search-sidebar .sidebar-generate-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: #94a3b8;
    border-color: #94a3b8;
  }
  .word-search-sidebar .sidebar-generate-caption {
    margin: 0;
    padding: 0 0.15rem;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
    color: #1a5a8c;
    max-width: 100%;
  }
  .word-search-sidebar .sidebar-generate-btn--ai {
    border-color: #6d28d9;
    background: #7c3aed;
  }
  .word-search-sidebar .sidebar-generate-btn--ai:hover:not(:disabled) {
    background: #6d28d9;
  }
  .word-search-sidebar .sidebar-generate-caption--ai {
    color: #6d28d9;
  }
  @media (max-width: 1023px) {
    .word-search-sidebar [role="tabpanel"] {
      height: auto !important;
      max-height: none !important;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      margin: 0.5rem !important;
      padding: 0.85rem !important;
    }
    .word-search-sidebar [role="tablist"] {
      width: 4.75rem;
      padding: 10px 8px 10px 10px;
    }
  }
`;

/**
 * Left pane — crossword generation / document controls.
 * Matches Word Search: Layout (global) + Document (this tab).
 */
export function CrosswordSidebar() {
  const {
    activeDocumentPage,
    activeDocumentPageId,
    crosswordSettings,
    crosswordBatchPuzzles,
    currentPuzzle,
    generatePuzzle,
    savePuzzle,
    titleWords,
    projectName,
  } = useApp();
  const { showBusy, hideBusy } = useOptionalAppBusy();
  const { crosswordPanelProps } = useCanvasEditPanel();
  const canvasEditOpen = !!crosswordPanelProps;

  const settings = useMemo(
    () => normalizeCrosswordSettings(crosswordSettings ?? getDefaultCrosswordSettings()),
    [crosswordSettings]
  );
  const { core } = settings;

  const [settingsPanel, setSettingsPanel] = usePersistedState<'layout' | 'document'>(
    SETTINGS_PANEL_STORAGE_KEY,
    'document'
  );
  const [activeTab, setActiveTab] = usePersistedState(SETTINGS_TAB_STORAGE_KEY, 'puzzle');
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = usePersistedState(SETTINGS_SIDEBAR_WIDTH_KEY, 352);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  React.useEffect(() => {
    const panel = normalizeSettingsPanel(settingsPanel);
    const tab = normalizeSettingsTab(activeTab, panel);
    if (panel !== settingsPanel) setSettingsPanel(panel);
    if (tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- normalize once on mount / module enter
  }, []);

  React.useEffect(() => {
    if (!canvasEditOpen) return;
    setSettingsPanel('document');
    setActiveTab('puzzle');
    setCollapsed(false);
  }, [canvasEditOpen, setSettingsPanel, setActiveTab]);

  if (activeDocumentPage?.moduleType !== 'crossword') {
    return null;
  }

  const answerCount = Math.max(
    parseCrosswordLines(core.answersText).length,
    titleWords.words.filter(Boolean).length
  );
  const puzzleCount = core.numberOfPuzzles || 1;
  const hasPuzzles =
    crosswordBatchPuzzles.some((p) => p.pageId === activeDocumentPageId) ||
    currentPuzzle?.type === 'crossword';
  const requiredPairs = Math.max(1, puzzleCount) * Math.max(1, core.cluesPerPuzzle);
  const isGenerateLocked = answerCount < requiredPairs || isGenerating;
  const generateLabel = hasPuzzles ? `Update ${puzzleCount}` : `Generate ${puzzleCount}`;
  const generateTitle = hasPuzzles
    ? `Update ${puzzleCount} crossword${puzzleCount === 1 ? '' : 's'}`
    : `Generate ${puzzleCount} crossword${puzzleCount === 1 ? '' : 's'}`;

  const isSettingsTabActive = (tab: string) => !collapsed && !canvasEditOpen && activeTab === tab;

  const handlePanelChange = (panel: 'layout' | 'document') => {
    if (panel === 'layout') {
      crosswordPanelProps?.onClose();
    }
    setSettingsPanel(panel);
    setActiveTab(normalizeSettingsTab(activeTab, panel));
    setCollapsed(false);
  };

  const handleTabChange = (value: string) => {
    if (value === 'puzzle' || value === 'words' || value === 'design') {
      crosswordPanelProps?.onClose();
    }
    const panel = normalizeSettingsPanel(value);
    setSettingsPanel(panel);
    setActiveTab(normalizeSettingsTab(value, panel));
    setCollapsed(false);
  };

  const handleTriggerPointerDown = (
    e: React.PointerEvent,
    tab: string
  ) => {
    if (activeTab === tab && !collapsed) {
      e.preventDefault();
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  };

  const handleSave = () => {
    const name = `${projectName || titleWords.title || 'crossword'} - ${new Date().toLocaleDateString()}`;
    savePuzzle(name);
  };

  const handleGenerate = () => {
    if (isGenerateLocked) return;
    setIsGenerating(true);
    showBusy(hasPuzzles ? 'Updating crossword…' : 'Generating crossword…');
    window.setTimeout(() => {
      try {
        void generatePuzzle();
      } finally {
        window.setTimeout(() => {
          hideBusy();
          setIsGenerating(false);
        }, 280);
      }
    }, 40);
  };

  const clampedSidebarWidth = Math.min(520, Math.max(280, sidebarWidth));

  const handleSidebarResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsSidebarResizing(true);
  };
  const handleSidebarResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSidebarResizing) return;
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    setSidebarWidth(Math.min(520, Math.max(280, e.clientX - rect.left)));
  };
  const handleSidebarResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsSidebarResizing(false);
  };

  return (
    <div
      className={cn(
        'word-search-sidebar relative h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-visible max-lg:w-full',
        collapsed
          ? 'w-28 transition-all duration-300'
          : isSidebarResizing
            ? ''
            : 'transition-[width] duration-75'
      )}
      style={collapsed || !isDesktopLayout ? undefined : { width: clampedSidebarWidth }}
    >
      <button
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-1/2 -right-2 z-50 hidden lg:flex items-center justify-center p-0 m-0 rounded-sm opacity-20 transition duration-100 hover:opacity-80 hover:scale-110"
        style={{
          transform: 'translateY(-50%)',
          width: 20,
          height: 22,
          background: '#e8ecf0',
          border: '1px solid #9ca3af',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderLeft: collapsed ? '8px solid #000' : '0 solid transparent',
            borderRight: collapsed ? '0 solid transparent' : '8px solid #000',
          }}
        />
      </button>

      {!collapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize settings panel"
          title="Drag to resize panel"
          onPointerDown={handleSidebarResizePointerDown}
          onPointerMove={handleSidebarResizePointerMove}
          onPointerUp={handleSidebarResizePointerUp}
          onPointerCancel={handleSidebarResizePointerUp}
          className="group/resize absolute inset-y-0 -right-1.5 z-40 hidden w-4 cursor-col-resize touch-none lg:block"
        >
          <span
            className={cn(
              'pointer-events-none absolute inset-y-12 right-[6px] w-1 rounded-full transition-colors',
              isSidebarResizing
                ? 'bg-sky-500'
                : 'bg-slate-300/70 group-hover/resize:bg-sky-400 dark:bg-slate-500/70'
            )}
          />
        </div>
      ) : null}

      <style>{SIDEBAR_RAIL_CSS}</style>

      <Tabs
        value={activeTab}
        orientation="vertical"
        className="w-full flex-1 flex min-h-0"
        onValueChange={handleTabChange}
      >
        <TabsList className="flex h-full min-h-0 flex-col w-[5.25rem] gap-4 bg-transparent shrink-0 px-0 py-0">
          <div className="sidebar-rail-group">
            <button
              type="button"
              onClick={() => handlePanelChange('layout')}
              className="sidebar-rail-heading"
              title="Book-wide layout settings"
            >
              <p className="sidebar-rail-heading__title">Layout</p>
            </button>
            <article className="sidebar-radio-input">
              <div className="sidebar-radio-options">
                <TabsTrigger
                  value="book"
                  label="Trim"
                  title="Trim size & margins"
                  className="w-full"
                  onPointerDown={(e) => {
                    setSettingsPanel('layout');
                    handleTriggerPointerDown(e, 'book');
                  }}
                >
                  <Book />
                </TabsTrigger>
                <TabsTrigger
                  value="colors"
                  label="Style"
                  title="Colors, frame & page numbers"
                  className="w-full"
                  onPointerDown={(e) => {
                    setSettingsPanel('layout');
                    handleTriggerPointerDown(e, 'colors');
                  }}
                >
                  <Palette />
                </TabsTrigger>
                <TabsTrigger
                  value="pages"
                  label="Chapters"
                  title="Chapter pages"
                  className="w-full"
                  onPointerDown={(e) => {
                    setSettingsPanel('layout');
                    handleTriggerPointerDown(e, 'pages');
                  }}
                >
                  <Sparkles />
                </TabsTrigger>
              </div>
            </article>
          </div>

          <div className="sidebar-rail-group">
            <button
              type="button"
              onClick={() => handlePanelChange('document')}
              className="sidebar-rail-heading"
              title="Settings for this document"
            >
              <p className="sidebar-rail-heading__title">Document</p>
            </button>
            <article className="sidebar-radio-input">
              <div className="sidebar-radio-options">
                <TabsTrigger
                  value="puzzle"
                  label="Puzzle"
                  title="Puzzle settings"
                  className="w-full"
                  onPointerDown={(e) => {
                    setSettingsPanel('document');
                    handleTriggerPointerDown(e, 'puzzle');
                  }}
                >
                  <Grid3X3 />
                </TabsTrigger>
                <TabsTrigger
                  value="words"
                  label="Words"
                  title="Clues & answers"
                  className="w-full"
                  onPointerDown={(e) => {
                    setSettingsPanel('document');
                    handleTriggerPointerDown(e, 'words');
                  }}
                >
                  <List />
                </TabsTrigger>
                <TabsTrigger
                  value="design"
                  label="Titles"
                  title="Puzzle titles"
                  className="w-full"
                  onPointerDown={(e) => {
                    setSettingsPanel('document');
                    handleTriggerPointerDown(e, 'design');
                  }}
                >
                  <Type />
                </TabsTrigger>
              </div>
            </article>
          </div>

          <div className="sidebar-generate-wrap">
            <button
              type="button"
              className="sidebar-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerateLocked}
              title={generateTitle}
              aria-label={generateTitle}
            >
              {hasPuzzles ? (
                <RefreshCw className={cn(isGenerating && 'animate-spin')} />
              ) : (
                <Zap />
              )}
            </button>
            <p className="sidebar-generate-caption">{generateLabel}</p>
            {isAiPuzzleType('crossword') ? (
              <>
                <button
                  type="button"
                  className="sidebar-generate-btn sidebar-generate-btn--ai"
                  onClick={() => setAiGenerateOpen(true)}
                  disabled={isGenerating}
                  title="Generate with AI"
                  aria-label="Generate with AI"
                >
                  <LucideSparkles />
                </button>
                <p className="sidebar-generate-caption sidebar-generate-caption--ai">
                  Generate with AI
                </p>
              </>
            ) : null}
          </div>
        </TabsList>

        {canvasEditOpen && crosswordPanelProps && !collapsed ? (
          <div
            className="flex-1 min-h-0 m-2 overflow-hidden rounded-lg border border-sky-200 bg-gradient-to-b from-white to-gray-50 shadow-sm dark:border-sky-800 dark:from-slate-800 dark:to-slate-850"
            style={{ height: 'calc(100vh - 100px)' }}
          >
            <CrosswordContextualControls {...crosswordPanelProps} variant="sidebar" />
          </div>
        ) : null}

        <TabsContent
          value="puzzle"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(PANEL_CLASS, (collapsed || canvasEditOpen) && 'hidden')}
        >
          {isSettingsTabActive('puzzle') ? (
            <CrosswordPuzzleSettingsPanel onSave={handleSave} />
          ) : null}
        </TabsContent>

        <TabsContent
          value="words"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(PANEL_CLASS, (collapsed || canvasEditOpen) && 'hidden')}
        >
          {isSettingsTabActive('words') ? (
            <CrosswordWordsSettingsPanel onSave={handleSave} />
          ) : null}
        </TabsContent>

        <TabsContent
          value="design"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(PANEL_CLASS, (collapsed || canvasEditOpen) && 'hidden')}
        >
          {isSettingsTabActive('design') ? (
            <CrosswordTitlesSettingsPanel onSave={handleSave} />
          ) : null}
        </TabsContent>

        <TabsContent
          value="book"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(PANEL_CLASS, (collapsed || canvasEditOpen) && 'hidden')}
        >
          {isSettingsTabActive('book') ? <LayoutBookPanel onSave={handleSave} /> : null}
        </TabsContent>

        <TabsContent
          value="colors"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(PANEL_CLASS, (collapsed || canvasEditOpen) && 'hidden')}
        >
          {isSettingsTabActive('colors') ? <LayoutColorsPanel onSave={handleSave} /> : null}
        </TabsContent>

        <TabsContent
          value="pages"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(PANEL_CLASS, (collapsed || canvasEditOpen) && 'hidden')}
        >
          {isSettingsTabActive('pages') ? <LayoutChaptersPanel onSave={handleSave} /> : null}
        </TabsContent>
      </Tabs>

      <AiProjectWizard
        open={aiGenerateOpen}
        onClose={() => setAiGenerateOpen(false)}
        onComplete={() => setAiGenerateOpen(false)}
        mode="current-document"
        lockedType="crossword"
        lockedCount={puzzleCount}
        defaultTitle={projectName || titleWords.title || 'Puzzle Book'}
      />
    </div>
  );
}

/** @deprecated Prefer CrosswordDocumentPanels + CrosswordSidebar shell. */
export function readCrosswordSettingsFromDocument(
  settings: unknown
): ReturnType<typeof normalizeCrosswordSettings> | null {
  if (!settings || typeof settings !== 'object') return null;
  try {
    return normalizeCrosswordSettings(settings as Parameters<typeof normalizeCrosswordSettings>[0]);
  } catch {
    return null;
  }
}
