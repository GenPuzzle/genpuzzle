'use client';

import React, { useRef, useState } from 'react';
import { Redo2, Undo2, X } from 'lucide-react';
import type { DocumentPage, DocumentModuleType } from '@/lib/document-model';
import { cn } from '@/lib/utils';
import { RemoveDocumentConfirmDialog } from '@/components/RemoveDocumentConfirmDialog';
import { CanvasDocumentInsertButton } from '@/components/CanvasDocumentInsertButton';
import './canvas-document-tabs.css';

interface CanvasDocumentTabsBarProps {
  documentPages: DocumentPage[];
  activeDocumentPageId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onInsert: (type: DocumentModuleType, position: 'before' | 'after', referenceId: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

function DocumentHistoryButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}) {
  return (
    <div className="doc-tabs-history" role="group" aria-label="Undo and redo">
      <button
        type="button"
        className="doc-tabs-history__btn"
        disabled={!canUndo}
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="doc-tabs-history__btn"
        disabled={!canRedo}
        onClick={onRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <Redo2 className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function CanvasDocumentTabsBar({
  documentPages,
  activeDocumentPageId,
  onSelect,
  onRemove,
  onReorder,
  onInsert,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: CanvasDocumentTabsBarProps) {
  const [pageToRemove, setPageToRemove] = useState<DocumentPage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const didDragRef = useRef(false);

  if (documentPages.length === 0) {
    return (
      <div className="doc-tabs-shell shrink-0 z-20">
        <div className="doc-tabs-header">
          <span className="doc-tabs-title">Documents</span>
          <DocumentHistoryButtons
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
          />
          <div className="doc-tabs-bar" role="tablist" aria-label="Document pages">
            <CanvasDocumentInsertButton
              variant="tab"
              side="after"
              referenceId=""
              onInsert={onInsert}
            />
          </div>
        </div>
      </div>
    );
  }

  const handleRemoveClick = (page: DocumentPage, event: React.MouseEvent) => {
    event.stopPropagation();
    if (documentPages.length <= 1) return;
    setPageToRemove(page);
  };

  const handleConfirmRemove = () => {
    if (pageToRemove) {
      onRemove(pageToRemove.id);
      setPageToRemove(null);
    }
  };

  const handleDragStart = (pageId: string, event: React.DragEvent) => {
    didDragRef.current = true;
    setDraggingId(pageId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
  };

  const handleDragOver = (pageId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggingId && draggingId !== pageId) {
      setDropTargetId(pageId);
    }
  };

  const handleDrop = (pageId: string, event: React.DragEvent) => {
    event.preventDefault();
    const fromId = event.dataTransfer.getData('text/plain') || draggingId;
    if (fromId && fromId !== pageId) {
      onReorder(fromId, pageId);
    }
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handleSelect = (pageId: string) => {
    if (didDragRef.current) return;
    onSelect(pageId);
  };

  return (
    <>
      <RemoveDocumentConfirmDialog
        open={pageToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPageToRemove(null);
        }}
        pageName={pageToRemove?.name ?? ''}
        onConfirm={handleConfirmRemove}
      />

      <div className="doc-tabs-shell shrink-0 z-20">
        <div className="doc-tabs-header">
          <span className="doc-tabs-title">Documents</span>
          <DocumentHistoryButtons
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
          />
          <div className="doc-tabs-bar" role="tablist" aria-label="Document pages">
            {documentPages.map((page, idx) => {
              const isActive = activeDocumentPageId === page.id;
              const isDragging = draggingId === page.id;
              const isDropTarget = dropTargetId === page.id;
              const displayName =
                page.name.length > 22 ? `${page.name.slice(0, 22)}…` : page.name;

              return (
                <React.Fragment key={page.id}>
                  <div
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={cn(
                      'doc-tab',
                      isActive && 'doc-tab--active',
                      isDragging && 'doc-tab--dragging',
                      isDropTarget && 'doc-tab--drop-target'
                    )}
                    onDragOver={(event) => handleDragOver(page.id, event)}
                    onDrop={(event) => handleDrop(page.id, event)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelect(page.id);
                      }
                    }}
                  >
                    <div
                      className="doc-tab__name"
                      draggable
                      onDragStart={(event) => handleDragStart(page.id, event)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleSelect(page.id)}
                    >
                      <span className="doc-tab__pre-name" aria-hidden />
                      <span className="doc-tab__label">
                        <span className="doc-tab__select" title={page.name}>
                          {idx + 1}. {displayName}
                        </span>
                        {documentPages.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove ${page.name}`}
                            title={`Remove ${page.name}`}
                            className="doc-tab__remove"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(e) => handleRemoveClick(page, e)}
                          >
                            <X className="h-2.5 w-2.5 stroke-[2.5]" />
                          </button>
                        )}
                      </span>
                      <span className="doc-tab__pos-name" aria-hidden />
                    </div>
                  </div>
                  <CanvasDocumentInsertButton
                    variant="tab"
                    side="after"
                    referenceId={page.id}
                    onInsert={onInsert}
                    className="doc-tabs-add--beside"
                    title={`Add page after ${page.name}`}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
