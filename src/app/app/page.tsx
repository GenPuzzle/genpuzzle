'use client';

import React, { useState, useEffect } from 'react';
import { WordSearchSidebar } from '@/components/WordSearchSidebar';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { FloatingHelpWidget } from '@/components/FloatingHelpWidget';
import { EditorTutorial } from '@/components/auth/EditorTutorial';
import { Menu, X } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { CanvasEditPanelProvider } from '@/lib/canvas-edit-panel-context';
import { cn } from '@/lib/utils';

function PuzzleGeneratorApp() {
  const { previewRangeMode, setPreviewRangeMode } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const settingsLocked = previewRangeMode === 'all' || previewRangeMode === 'flipbook';

  const exitLockedPreview = () => setPreviewRangeMode('sample');

  // Prevent background scroll while the settings drawer is open on phones.
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <CanvasEditPanelProvider>
    <div className="gp-app-shell flex h-full flex-col lg:flex-row min-h-0 bg-gradient-to-br from-[#F0F5F6] to-white dark:from-slate-950 dark:to-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-2s" style={{ background: 'rgba(34, 118, 180, 0.3)' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-4s"></div>
      </div>

      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="mobile-sidebar-toggle lg:hidden fixed left-3 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md transition-colors duration-150 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
        aria-label={sidebarOpen ? 'Close settings panel' : 'Open settings panel'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? (
          <X className="w-5 h-5 text-slate-700 dark:text-white" />
        ) : (
          <Menu className="w-5 h-5 text-slate-700 dark:text-white" />
        )}
      </button>

      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-black/45"
          aria-label="Close settings panel"
        />
      )}

      <div
        className={cn(
          'gp-mobile-drawer fixed lg:static inset-y-0 left-0 z-40 h-full max-lg:pt-[env(safe-area-inset-top,0px)] max-lg:pb-[env(safe-area-inset-bottom,0px)] w-[min(100vw-2.5rem,22rem)] lg:w-auto transition-transform duration-300 ease-out lg:translate-x-0 shadow-2xl lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none lg:pointer-events-auto'
        )}
        aria-hidden={!sidebarOpen ? true : undefined}
      >
        {settingsLocked && (
          <div
            className={cn(
              'absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]',
              previewRangeMode === 'flipbook' && 'cursor-pointer'
            )}
            aria-live="polite"
            onClick={previewRangeMode === 'flipbook' ? exitLockedPreview : undefined}
            onKeyDown={(e) => {
              if (previewRangeMode !== 'flipbook') return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                exitLockedPreview();
              }
            }}
            role={previewRangeMode === 'flipbook' ? 'button' : undefined}
            tabIndex={previewRangeMode === 'flipbook' ? 0 : undefined}
            aria-label={previewRangeMode === 'flipbook' ? 'Close 3D book preview' : undefined}
          >
            <div
              className="mx-4 max-w-[15rem] rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-center shadow-lg pointer-events-none dark:border-slate-600 dark:bg-slate-800/95"
            >
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Settings locked</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {previewRangeMode === 'flipbook'
                  ? '3D book preview is active. Click outside or use Close to exit.'
                  : 'All pages preview is active. Use Edit on a page or switch back to Sample to change settings.'}
              </p>
            </div>
          </div>
        )}
        <WordSearchSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full lg:w-auto min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden p-0 sm:p-1 md:p-4 lg:p-6 min-h-0 max-lg:pt-0">
          <div className="flex-1 flex flex-col min-h-0 rounded-none md:rounded-2xl bg-white dark:bg-slate-800 shadow-none md:shadow-2xl ring-0 md:ring-1 md:ring-white/20 dark:ring-slate-700/20 overflow-hidden">
            <PreviewCanvas />
          </div>
        </div>
      </div>

      <FloatingHelpWidget />
      <EditorTutorial />

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2s {
          animation-delay: 2s;
        }
        
        .animation-delay-4s {
          animation-delay: 4s;
        }

        @media (max-width: 1023px) {
          .gp-mobile-drawer .word-search-sidebar,
          .gp-mobile-drawer .crossword-sidebar {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
    </CanvasEditPanelProvider>
  );
}

export default function Home() {
  return <PuzzleGeneratorApp />;
}
