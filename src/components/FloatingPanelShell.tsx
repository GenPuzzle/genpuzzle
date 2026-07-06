'use client';

import React from 'react';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFloatingPanel } from '@/hooks/useFloatingPanel';
import { CanvasEditTabsBar, type CanvasEditPanelTab } from '@/components/CanvasEditTabsBar';

interface FloatingPanelShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tabs?: CanvasEditPanelTab[];
  activeTabId?: string | null;
  onTabSelect?: (id: string) => void;
  onTabClose?: (id: string) => void;
}

export function FloatingPanelShell({
  title,
  onClose,
  children,
  footer,
  tabs,
  activeTabId = null,
  onTabSelect,
  onTabClose,
}: FloatingPanelShellProps) {
  const {
    panelRef,
    minimized,
    dragging,
    panelStyle,
    toggleMinimized,
    handleHeaderPointerDown,
  } = useFloatingPanel();

  return (
    <div
      ref={panelRef}
      className={cn(
        'canvas-context-panel',
        minimized && 'canvas-context-panel--minimized',
        dragging && 'canvas-context-panel--dragging'
      )}
      style={panelStyle}
      role="dialog"
      aria-label={title}
      aria-modal="false"
    >
      <div
        className="canvas-context-panel__header"
        onPointerDown={handleHeaderPointerDown}
        title="Drag to move"
      >
        <GripVertical
          className="canvas-context-panel__grip"
          aria-hidden
          strokeWidth={2.25}
        />
        <span className="canvas-context-panel__title">{title}</span>
        <div className="canvas-context-panel__header-actions">
          <button
            type="button"
            className="canvas-context-panel__icon-btn"
            onClick={toggleMinimized}
            aria-label={minimized ? 'Expand panel' : 'Minimize panel'}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </button>
          <button
            type="button"
            className="canvas-context-panel__close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {!minimized && tabs && tabs.length > 0 && onTabSelect && onTabClose && (
        <CanvasEditTabsBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={onTabSelect}
          onClose={onTabClose}
        />
      )}

      {!minimized && (
        <>
          <div className="canvas-context-panel__body">{children}</div>
          {footer}
        </>
      )}
    </div>
  );
}
