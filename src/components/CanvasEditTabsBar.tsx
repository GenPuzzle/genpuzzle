'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import './canvas-edit-tabs.css';

export interface CanvasEditPanelTab {
  id: string;
  label: string;
}

interface CanvasEditTabsBarProps {
  tabs: CanvasEditPanelTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function CanvasEditTabsBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
}: CanvasEditTabsBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="canvas-edit-tabs-shell">
      <div className="canvas-edit-tabs-header">
        <span className="canvas-edit-tabs-title">Adjust</span>
        <div className="canvas-edit-tabs-bar" role="tablist" aria-label="Edit control tabs">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={cn('canvas-edit-tab', isActive && 'canvas-edit-tab--active')}
              >
                <div
                  className="canvas-edit-tab__name"
                  onClick={() => onSelect(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(tab.id);
                    }
                  }}
                >
                  <span className="canvas-edit-tab__pre-name" aria-hidden />
                  <span className="canvas-edit-tab__label">
                    <span className="canvas-edit-tab__select" title={tab.label}>
                      {tab.label}
                    </span>
                    <button
                      type="button"
                      aria-label={`Close ${tab.label}`}
                      title={`Close ${tab.label}`}
                      className="canvas-edit-tab__remove"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onClose(tab.id);
                      }}
                    >
                      <X className="h-2.5 w-2.5 stroke-[2.5]" />
                    </button>
                  </span>
                  <span className="canvas-edit-tab__pos-name" aria-hidden />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
