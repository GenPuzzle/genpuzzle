'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  formatPageVariableText,
  type PageVariableTextForm,
} from '@/lib/page-variables';
import {
  TEXT_VARIABLE_KEYS,
  TEXT_VARIABLE_LABELS,
  tokenForVariableKey,
} from '@/lib/ai/text-variable-tokens';
import { cn } from '@/lib/utils';
import './page-variable-dialogs.css';

const TEXT_FORMS: Array<{
  id: PageVariableTextForm;
  label: (start: number) => string;
}> = [
  { id: 'text-hash-number', label: (start) => `text variables #${start}` },
  { id: 'number-dot-text', label: (start) => `${start}. text variables` },
  { id: 'text', label: () => 'Text variable' },
  { id: 'number', label: (start) => String(start) },
];

async function fileToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image'));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not draw image');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function PageVariableModal({
  open,
  title,
  hint,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  hint: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    openedAtRef.current = Date.now();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="page-variable-modal__backdrop"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
        aria-hidden
        onClick={() => {
          if (Date.now() - openedAtRef.current < 400) return;
          onClose();
        }}
      />
      <div
        className="page-variable-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="page-variable-modal__panel"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="page-variable-modal__header">
            <h2 className="page-variable-modal__title">{title}</h2>
            <button type="button" className="gp-alert-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="page-variable-modal__hint">{hint}</p>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

export function PageVariableTextDialog({
  open,
  initialLines,
  initialForm,
  initialStartNumber,
  initialVariableKey,
  singlePage = false,
  onClose,
  onSave,
}: {
  open: boolean;
  initialLines: string[];
  initialForm?: PageVariableTextForm;
  initialStartNumber?: number;
  initialVariableKey?: string;
  singlePage?: boolean;
  onClose: () => void;
  onSave: (next: {
    textLines: string[];
    textForm: PageVariableTextForm;
    startNumber: number;
    variableKey?: string;
  }) => void;
}) {
  const [text, setText] = useState(initialLines.join('\n'));
  const [textForm, setTextForm] = useState<PageVariableTextForm>(initialForm ?? 'text');
  const [startNumber, setStartNumber] = useState(initialStartNumber ?? 1);
  const [variableKey, setVariableKey] = useState<string>(initialVariableKey || 'none');
  const [sourceMode, setSourceMode] = useState<'static' | 'variable'>(
    initialVariableKey && initialVariableKey !== 'none' ? 'variable' : 'static'
  );

  useEffect(() => {
    if (!open) return;
    setText(singlePage ? (initialLines[0] ?? '') : initialLines.join('\n'));
    setTextForm(singlePage ? 'text' : (initialForm ?? 'text'));
    setStartNumber(Math.max(1, Math.round(initialStartNumber ?? 1)));
    setVariableKey(initialVariableKey || 'none');
    setSourceMode(
      initialVariableKey && initialVariableKey !== 'none' ? 'variable' : 'static'
    );
  }, [open, initialForm, initialStartNumber, initialLines, singlePage, initialVariableKey]);

  const preview = formatPageVariableText(
    {
      id: 'preview',
      kind: 'text',
      xPercent: 0,
      yPercent: 0,
      widthPercent: 40,
      heightPercent: 8,
      textLines: singlePage ? [text] : text.split(/\r?\n/),
      textForm,
      startNumber,
      variableKey: sourceMode === 'variable' && variableKey !== 'none'
        ? (variableKey as import('@/lib/ai/text-variable-tokens').TextVariableKey)
        : 'none',
    },
    0,
    true,
    {
      funFact: 'Octopuses have three hearts.',
      puzzleTitle: 'Ocean Giants',
      puzzleNumber: startNumber,
      chapterTitle: 'Ocean Life',
      chapterNumber: 1,
      instruction: 'Find all the words.',
      puzzleSentence: 'Keep exploring.',
      solutionPage: 145,
      difficulty: 'medium',
      theme: 'Sea',
      puzzleType: 'Word Search',
      pageNumber: 1,
      wordCount: 12,
      contentIndex: 0,
    }
  );

  return (
    <PageVariableModal
      open={open}
      title={singlePage ? 'Add text' : 'Variable text'}
      hint={
        singlePage
          ? 'This text appears only on the current puzzle page.'
          : 'Choose a number form, then enter one line per puzzle page. Line 1 appears on page 1, line 2 on page 2.'
      }
      onClose={onClose}
    >
      {!singlePage ? (
        <>
          <div className="page-variable-modal__field">
            <label className="page-variable-modal__label" htmlFor="pv-start-number">
              Start numbers count at
            </label>
            <input
              id="pv-start-number"
              className="page-variable-modal__number"
              type="number"
              min={1}
              value={startNumber}
              onChange={(event) =>
                setStartNumber(Math.max(1, Math.round(Number(event.target.value) || 1)))
              }
            />
          </div>

          <div className="page-variable-modal__field">
            <span className="page-variable-modal__label">Form</span>
            <div className="page-variable-modal__form">
              {TEXT_FORMS.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  className={cn(
                    'page-variable-modal__form-btn',
                    textForm === form.id && 'page-variable-modal__form-btn--active'
                  )}
                  onClick={() => setTextForm(form.id)}
                >
                  {form.label(startNumber)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="page-variable-modal__field">
        <span className="page-variable-modal__label">Text source</span>
        <div className="page-variable-modal__form">
          <button
            type="button"
            className={cn(
              'page-variable-modal__form-btn',
              sourceMode === 'static' && 'page-variable-modal__form-btn--active'
            )}
            onClick={() => setSourceMode('static')}
          >
            Static text
          </button>
          <button
            type="button"
            className={cn(
              'page-variable-modal__form-btn',
              sourceMode === 'variable' && 'page-variable-modal__form-btn--active'
            )}
            onClick={() => {
              setSourceMode('variable');
              if (variableKey === 'none') setVariableKey('fun_fact');
            }}
          >
            Variable
          </button>
        </div>
      </div>

      {sourceMode === 'variable' ? (
        <div className="page-variable-modal__field">
          <label className="page-variable-modal__label" htmlFor="pv-variable-key">
            Variable
          </label>
          <select
            id="pv-variable-key"
            className="page-variable-modal__number"
            value={variableKey}
            onChange={(event) => {
              const next = event.target.value;
              setVariableKey(next);
              if (next !== 'none' && !text.trim()) {
                setText(tokenForVariableKey(next as (typeof TEXT_VARIABLE_KEYS)[number]));
              }
            }}
          >
            {TEXT_VARIABLE_KEYS.map((key) => (
              <option key={key} value={key}>
                {TEXT_VARIABLE_LABELS[key]} ({tokenForVariableKey(key)})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {textForm !== 'number' || singlePage ? (
        <div className="page-variable-modal__field">
          <label className="page-variable-modal__label" htmlFor="pv-text-lines">
            {singlePage
              ? 'Text'
              : sourceMode === 'variable'
                ? 'Values / tokens (one per page)'
                : 'Texts (one per page)'}
          </label>
          <textarea
            id="pv-text-lines"
            className="page-variable-modal__textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              singlePage
                ? 'Type the text for this page'
                : sourceMode === 'variable'
                  ? '[fun fact]\nor paste one value per page'
                  : 'Page 1 text\nPage 2 text\nPage 3 text'
            }
            rows={singlePage ? 4 : undefined}
          />
        </div>
      ) : null}

      {!singlePage ? (
        <p className="page-variable-modal__preview">
          Page 1 preview: <strong>{preview}</strong>
        </p>
      ) : null}

      <div className="page-variable-modal__actions">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() =>
            onSave({
              textLines: singlePage ? [text] : text.split(/\r?\n/),
              textForm: singlePage ? 'text' : textForm,
              startNumber,
              variableKey: sourceMode === 'variable' ? variableKey : 'none',
            })
          }
        >
          Apply
        </Button>
      </div>
    </PageVariableModal>
  );
}

export function PageVariableImageDialog({
  open,
  initialHrefs,
  singlePage = false,
  onClose,
  onSave,
}: {
  open: boolean;
  initialHrefs: string[];
  singlePage?: boolean;
  onClose: () => void;
  onSave: (hrefs: string[]) => void;
}) {
  const [hrefs, setHrefs] = useState<string[]>(initialHrefs);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHrefs(initialHrefs);
  }, [open, initialHrefs]);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const next = await Promise.all(files.map((file) => fileToDataUrl(file)));
      setHrefs((prev) => (singlePage ? next.slice(0, 1) : [...prev, ...next]));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageVariableModal
      open={open}
      title={singlePage ? 'Add image' : 'Image variables'}
      hint={
        singlePage
          ? 'This image appears only on the current puzzle page.'
          : 'Upload images in page order. The first image appears on page 1, the second on page 2.'
      }
      onClose={onClose}
    >
      <label className="page-variable-modal__drop">
        <strong>{busy ? 'Adding images…' : singlePage ? 'Click to upload an image' : 'Click to upload images'}</strong>
        <span>{singlePage ? 'PNG, JPG, or SVG' : 'You can select several files at once'}</span>
        <input
          type="file"
          accept="image/*"
          multiple={!singlePage}
          disabled={busy}
          className="sr-only"
          onChange={async (event) => {
            await addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </label>

      {hrefs.length > 0 ? (
        <div className="page-variable-modal__field">
          <span className="page-variable-modal__label">
            {hrefs.length} image{hrefs.length === 1 ? '' : 's'} (page order)
          </span>
          <div className="page-variable-modal__thumbs">
            {hrefs.map((href, index) => (
              <div key={`${index}-${href.slice(0, 24)}`} className="page-variable-modal__thumb">
                <img src={href} alt={`Page ${index + 1}`} />
                <span className="page-variable-modal__thumb-n">{index + 1}</span>
                <button
                  type="button"
                  className="page-variable-modal__thumb-x"
                  onClick={() => setHrefs((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="page-variable-modal__hint">No images uploaded yet.</p>
      )}

      <div className="page-variable-modal__actions">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {hrefs.length > 0 ? (
          <Button type="button" variant="outline" onClick={() => setHrefs([])}>
            Clear
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={hrefs.length === 0 || busy}
          onClick={() => onSave(hrefs)}
        >
          Apply
        </Button>
      </div>
    </PageVariableModal>
  );
}
