'use client';

import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { AiCopilotPanel } from '@/components/ai/AiCopilotPanel';
import { useAiCopilotUi } from '@/lib/ai-copilot-ui-context';
import { cn } from '@/lib/utils';

/**
 * Workspace floating launcher — opens GenPuzzle AI (replaces the old Help inbox).
 */
export function FloatingHelpWidget() {
  const { open, openCopilot, closeCopilot, setOpen, selectedElements } = useAiCopilotUi();

  return (
    <>
      <AiCopilotPanel
        open={open}
        onClose={closeCopilot}
        selectedElements={selectedElements}
      />

      {!open ? (
        <div className="floating-help-root" aria-live="polite">
          <button
            type="button"
            onClick={openCopilot}
            className={cn('floating-help-btn')}
            aria-expanded={false}
            aria-label="Open AI assistant — let AI edit or help"
            title="Let AI edit / help"
          >
            <Sparkles className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            <span className="floating-help-btn__label">AI</span>
          </button>
        </div>
      ) : null}

      {/* Keep a tiny close affordance if panel is somehow hidden behind other chrome */}
      {open ? (
        <button
          type="button"
          className="sr-only"
          onClick={() => setOpen(false)}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <style jsx global>{`
        .floating-help-root {
          position: fixed;
          bottom: 1.25rem;
          right: 1.25rem;
          z-index: 200;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.75rem;
          pointer-events: none;
        }

        .floating-help-btn {
          pointer-events: auto;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.15rem !important;
          width: 3.75rem !important;
          height: 3.75rem !important;
          min-width: 3.75rem !important;
          min-height: 3.75rem !important;
          max-width: 3.75rem !important;
          max-height: 3.75rem !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          border-radius: 50% !important;
          background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%) !important;
          color: #ffffff !important;
          cursor: pointer;
          box-shadow:
            0 0 0 3px rgba(124, 58, 237, 0.25),
            0 0 22px rgba(124, 58, 237, 0.45),
            0 4px 14px rgba(91, 33, 182, 0.35) !important;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          transform: none !important;
        }

        .floating-help-btn__label {
          font-size: 0.55rem !important;
          font-weight: 800 !important;
          letter-spacing: 0.06em;
          line-height: 1 !important;
          text-transform: uppercase;
        }

        .floating-help-btn:hover {
          background: linear-gradient(180deg, #8b5cf6 0%, #5b21b6 100%) !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow:
            0 0 0 3px rgba(124, 58, 237, 0.35),
            0 0 26px rgba(124, 58, 237, 0.55),
            0 6px 16px rgba(91, 33, 182, 0.4) !important;
          transform: scale(1.05) !important;
        }

        .floating-help-btn:active {
          transform: scale(0.96) !important;
        }

        @media (max-width: 768px) {
          .floating-help-root {
            bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px));
            right: calc(0.65rem + env(safe-area-inset-right, 0px));
          }

          .floating-help-btn {
            width: 3rem !important;
            height: 3rem !important;
            min-width: 3rem !important;
            min-height: 3rem !important;
            max-width: 3rem !important;
            max-height: 3rem !important;
            box-shadow:
              0 0 0 2px rgba(124, 58, 237, 0.2),
              0 4px 12px rgba(91, 33, 182, 0.35) !important;
          }

          .floating-help-btn__label {
            font-size: 0.5rem !important;
          }
        }
      `}</style>
    </>
  );
}
