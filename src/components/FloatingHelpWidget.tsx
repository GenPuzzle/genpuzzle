'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { compileBook, groupPuzzlesByDocument } from '@/lib/book-compiler';
import type { PuzzleModuleSettings } from '@/lib/document-model';
import { cn } from '@/lib/utils';

interface HelpMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="floating-help-info-row">
      <span className="floating-help-info-label">{label}</span>
      <span className="floating-help-info-value">{value}</span>
    </div>
  );
}

export function FloatingHelpWidget() {
  const {
    projectName,
    titleWords,
    wordSearchSettings,
    documentPages,
    activeDocumentPageId,
    batchPuzzles,
    previewRangeMode,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<HelpMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! Ask anything about your book layout, export settings, or puzzle generation. Replies are placeholders until the help inbox is connected to your database.',
      at: Date.now(),
    },
  ]);
  const inboxRef = useRef<HTMLDivElement>(null);

  const includeBleed = wordSearchSettings.bookCanvas.includeBleed;
  const widthInches = wordSearchSettings.bookCanvas.customWidth || 8.5;
  const heightInches = wordSearchSettings.bookCanvas.customHeight || 11;
  const units = wordSearchSettings.bookCanvas.measurementUnits || 'Inches';

  const documentPagesForBook = useMemo(() => {
    return documentPages.map((page) => {
      if (page.id === activeDocumentPageId && page.moduleType === 'word-search') {
        const settings = page.settings as PuzzleModuleSettings;
        return {
          ...page,
          settings: {
            ...settings,
            titleWords,
            wordSearchSettings,
          },
        };
      }
      return page;
    });
  }, [documentPages, activeDocumentPageId, titleWords, wordSearchSettings]);

  const compiledBook = useMemo(() => {
    if (documentPages.length === 0) return null;
    const puzzleMap = groupPuzzlesByDocument(batchPuzzles, documentPagesForBook);
    return compileBook(documentPagesForBook, puzzleMap, { includeSolutions: true });
  }, [documentPages.length, documentPagesForBook, batchPuzzles]);

  const moduleSummary = useMemo(() => {
    if (documentPages.length === 0) return 'None';
    return documentPages.map((page) => page.name).join(', ');
  }, [documentPages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    const userMessage: HelpMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      at: Date.now(),
    };

    const assistantMessage: HelpMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: 'Thanks for your message! Help inbox replies will be stored and answered once connected to your database.',
      at: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft('');

    requestAnimationFrame(() => {
      inboxRef.current?.scrollTo({ top: inboxRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  return (
    <>
      <div className="floating-help-root" aria-live="polite">
        {open && (
          <div className="floating-help-panel" role="dialog" aria-label="Help panel">
            <section className="floating-help-book-info">
              <h3 className="floating-help-section-title">Book Info</h3>
              <div className="floating-help-book-info-scroll">
                <InfoRow label="Project" value={projectName || 'Untitled Project'} />
                <InfoRow label="Book title" value={titleWords.title || '—'} />
                <InfoRow label="Trim size" value={`${widthInches}" × ${heightInches}"`} />
                <InfoRow label="Units" value={units} />
                <InfoRow
                  label="Bleed"
                  value={includeBleed ? 'Included (0.375" safe)' : 'No bleed (0.25" safe)'}
                />
                <InfoRow label="Document modules" value={moduleSummary} />
                <InfoRow label="Generated puzzles" value={String(batchPuzzles.length)} />
                <InfoRow label="Compiled pages" value={String(compiledBook?.totalPages ?? 0)} />
                <InfoRow
                  label="Preview mode"
                  value={
                    previewRangeMode === 'sample'
                      ? 'Single active page'
                      : previewRangeMode === 'flipbook'
                        ? '3D flipbook (full book)'
                        : 'All pages preview'
                  }
                />
              </div>
            </section>

            <section className="floating-help-inbox">
              <h3 className="floating-help-section-title">Help inbox</h3>
              <div ref={inboxRef} className="floating-help-messages">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'floating-help-message',
                      msg.role === 'user' ? 'floating-help-message--user' : 'floating-help-message--assistant'
                    )}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
              <form
                className="floating-help-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="floating-help-input"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="floating-help-send-btn"
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </section>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn('floating-help-btn', open && 'floating-help-btn--open')}
          aria-expanded={open}
          aria-label={open ? 'Close help panel' : 'Open help panel'}
        >
          HELP
        </button>
      </div>

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
          align-items: center !important;
          justify-content: center !important;
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
          background: linear-gradient(180deg, #2276b4 0%, #1a5a8c 100%) !important;
          color: #ffffff !important;
          font-size: 0.625rem !important;
          font-weight: 800 !important;
          letter-spacing: 0.04em;
          line-height: 1 !important;
          text-align: center !important;
          cursor: pointer;
          box-shadow:
            0 0 0 3px rgba(34, 118, 180, 0.25),
            0 0 22px rgba(34, 118, 180, 0.55),
            0 4px 14px rgba(26, 90, 140, 0.35) !important;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          transform: none !important;
        }

        .floating-help-btn:hover {
          background: linear-gradient(180deg, #2a84c4 0%, #1a5a8c 100%) !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow:
            0 0 0 3px rgba(34, 118, 180, 0.35),
            0 0 26px rgba(34, 118, 180, 0.65),
            0 6px 16px rgba(26, 90, 140, 0.4) !important;
          transform: scale(1.05) !important;
        }

        .floating-help-btn:active {
          transform: scale(0.96) !important;
        }

        .floating-help-btn--open {
          box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.45),
            0 0 22px rgba(34, 118, 180, 0.55),
            0 4px 14px rgba(26, 90, 140, 0.35) !important;
        }

        .floating-help-panel {
          pointer-events: auto;
          width: min(calc(100vw - 2rem), 22rem);
          height: min(70vh, 34rem);
          display: flex;
          flex-direction: column;
          border-radius: 1rem;
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          box-shadow:
            0 20px 40px rgba(15, 23, 42, 0.14),
            0 0 0 1px rgba(255, 255, 255, 0.6);
          overflow: hidden;
          animation: floating-help-panel-in 0.22s ease-out;
        }

        @keyframes floating-help-panel-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .floating-help-book-info {
          flex: 0 0 auto;
          max-height: 42%;
          min-height: 7.5rem;
          padding: 0.875rem 1rem 0.75rem;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .floating-help-book-info-scroll {
          overflow-y: auto;
          min-height: 0;
          padding-right: 0.25rem;
        }

        .floating-help-inbox {
          flex: 1 1 auto;
          min-height: 12rem;
          display: flex;
          flex-direction: column;
          padding: 0.875rem 1rem 1rem;
          background: #ffffff;
          min-width: 0;
        }

        .floating-help-section-title {
          margin: 0 0 0.5rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          flex-shrink: 0;
        }

        .floating-help-info-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.375rem 0;
          font-size: 0.75rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .floating-help-info-row:last-child {
          border-bottom: none;
        }

        .floating-help-info-label {
          color: #64748b;
          flex-shrink: 0;
        }

        .floating-help-info-value {
          color: #0f172a;
          font-weight: 600;
          text-align: right;
        }

        .floating-help-messages {
          flex: 1 1 auto;
          min-height: 6.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding-right: 0.125rem;
        }

        .floating-help-message {
          max-width: 92%;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          line-height: 1.45;
        }

        .floating-help-message--assistant {
          align-self: flex-start;
          background: #f1f5f9;
          color: #334155;
          border-bottom-left-radius: 0.2rem;
        }

        .floating-help-message--user {
          align-self: flex-end;
          background: #1a5a8c;
          color: #ffffff;
          border-bottom-right-radius: 0.2rem;
        }

        .floating-help-compose {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .floating-help-input {
          flex: 1;
          min-width: 0;
          height: 2.25rem;
          border-radius: 9999px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 0 0.875rem;
          font-size: 0.75rem;
          color: #0f172a;
          outline: none;
        }

        .floating-help-input:focus {
          border-color: #2276b4;
          box-shadow: 0 0 0 3px rgba(34, 118, 180, 0.15);
        }

        .floating-help-send-btn {
          pointer-events: auto;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 2.25rem !important;
          height: 2.25rem !important;
          min-width: 2.25rem !important;
          min-height: 2.25rem !important;
          padding: 0 !important;
          border: none !important;
          border-radius: 50% !important;
          background: #1a5a8c !important;
          color: #ffffff !important;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(26, 90, 140, 0.25) !important;
          transform: none !important;
        }

        .floating-help-send-btn:hover:not(:disabled) {
          background: #2276b4 !important;
          color: #ffffff !important;
          border: none !important;
          transform: none !important;
        }

        .floating-help-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .floating-help-root {
            bottom: 5rem;
            right: 0.75rem;
          }

          .floating-help-panel {
            height: min(62vh, 30rem);
          }
        }
      `}</style>
    </>
  );
}
