'use client';

import React, { useState } from 'react';
import { WordSearchSidebar } from '@/components/WordSearchSidebar';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { FloatingHelpWidget } from '@/components/FloatingHelpWidget';
import { EditorTutorial } from '@/components/auth/EditorTutorial';
import { Menu, X } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/utils';

function PuzzleGeneratorApp() {
  const { currentPuzzleType, previewRangeMode, setPreviewRangeMode } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const settingsLocked = previewRangeMode === 'all' || previewRangeMode === 'flipbook';

  const exitLockedPreview = () => setPreviewRangeMode('sample');

  const isWordSearch = currentPuzzleType === 'word-search';

  return (
    <div className="flex h-full flex-col lg:flex-row min-h-0" style={{ background: 'linear-gradient(to bottom right, #F0F5F6, #ffffff)' }}>
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-2s" style={{ background: 'rgba(34, 118, 180, 0.3)' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-4s"></div>
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-[14px] right-6 z-50 p-2 bg-white/90 backdrop-blur-sm dark:bg-slate-800/90 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95 border border-slate-200 dark:border-slate-700"
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? (
          <X className="w-5 h-5 text-slate-700 dark:text-white" />
        ) : (
          <Menu className="w-5 h-5 text-slate-700 dark:text-white" />
        )}
      </button>

      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          aria-label="Close sidebar"
        />
      )}

      <div
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 h-full transition-all duration-300 ease-out transform w-64 lg:w-auto relative`}
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
              className="mx-4 max-w-[15rem] rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-center shadow-lg pointer-events-none"
            >
              <p className="text-xs font-bold text-slate-800">Settings locked</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {previewRangeMode === 'flipbook'
                  ? '3D book preview is active. Click outside or use Close to exit.'
                  : 'All pages preview is active. Use Edit on a page or switch back to Sample to change settings.'}
              </p>
            </div>
          </div>
        )}
        {isWordSearch ? <WordSearchSidebar /> : <WordSearchSidebar />}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full lg:w-auto min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden p-1 sm:p-2 md:p-4 lg:p-6 min-h-0">
          <div className="flex-1 flex flex-col min-h-0 rounded-lg md:rounded-2xl bg-white dark:bg-slate-800 shadow-lg md:shadow-2xl ring-1 ring-white/20 dark:ring-slate-700/20 overflow-hidden">
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

        @media (max-width: 768px) {
          iframe[title="PDF Preview"] {
            min-height: 400px;
          }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  return <PuzzleGeneratorApp />;
}
