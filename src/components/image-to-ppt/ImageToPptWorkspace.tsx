'use client';

import React from 'react';
import { ImageToPptToolbar } from '@/components/image-to-ppt/ImageToPptToolbar';
import { ImageToPptPageRail } from '@/components/image-to-ppt/ImageToPptPageRail';
import { ImageToPptCanvasStage } from '@/components/image-to-ppt/ImageToPptCanvasStage';
import { TextPageContextualControls } from '@/components/TextPageContextualControls';
import { isTextModuleSettings } from '@/lib/document-model';
import { useApp } from '@/lib/app-context';
import { useImageToPpt } from '@/lib/image-to-ppt-context';

export function ImageToPptWorkspace() {
  const { wordSearchSettings } = useApp();
  const {
    activePage,
    activeDocumentPage,
    selectedBlockId,
    selectBlock,
    updateActiveTextSettings,
    toggleKeepBackground,
  } = useImageToPpt();

  return (
    <div className="gp-app-shell flex h-full min-h-0 flex-col bg-gradient-to-br from-[#F0F5F6] to-white dark:from-slate-950 dark:to-slate-900">
      <ImageToPptToolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="border-b border-slate-200 px-3 py-3">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white">Image to Editable PPT</h1>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Reconstruct scanned pages into editable GenPuzzle text and SVG graphics. No generative AI.
            </p>
            {activePage && (
              <label className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={activePage.keepRasterBackground}
                  onChange={(event) => toggleKeepBackground(activePage.id, event.target.checked)}
                />
                Keep textured background layer
              </label>
            )}
          </div>
          <ImageToPptPageRail />
          {activeDocumentPage && isTextModuleSettings(activeDocumentPage.settings) && (
            <div className="max-h-[42%] overflow-auto border-t border-slate-200">
                <TextPageContextualControls
                pageName={activeDocumentPage.name}
                settings={activeDocumentPage.settings}
                globalSettings={wordSearchSettings}
                activeTarget="page-elements"
                selectedBlockId={selectedBlockId}
                onTargetChange={() => {}}
                onSelectBlock={(blockId) => selectBlock(blockId)}
                onSettingsChange={updateActiveTextSettings}
                onClose={() => selectBlock(null)}
                variant="sidebar"
              />
            </div>
          )}
        </aside>
        <ImageToPptCanvasStage />
      </div>
    </div>
  );
}
