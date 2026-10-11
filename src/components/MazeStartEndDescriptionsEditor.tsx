'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MazeStartEndPair } from '@/lib/maze-start-end-images';

export function MazeStartEndDescriptionsEditor({
  open,
  onOpenChange,
  pairs,
  initialSheet,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairs: MazeStartEndPair[];
  initialSheet: number;
  onSave: (pairs: MazeStartEndPair[]) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const [draft, setDraft] = useState<MazeStartEndPair[]>(pairs);
  const [sheet, setSheet] = useState(initialSheet);
  const sheetCount = Math.max(1, Math.ceil(Math.max(draft.length, 1) / 10));
  const safeSheet = Math.min(sheet, sheetCount - 1);

  useEffect(() => {
    if (!open) return;
    setDraft(pairs.map((pair) => ({ ...pair })));
    setSheet(initialSheet);
    // Load the current descriptions when the page opens. Later parent renders must not wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      closingRef.current = false;
      if (!dialog.open) dialog.showModal();
    }
  }, [open]);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onOpenChange(false);
  };

  const updatePair = (index: number, patch: Partial<MazeStartEndPair>) => {
    setDraft((current) => current.map((pair, pairIndex) => (pairIndex === index ? { ...pair, ...patch } : pair)));
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="z-[30000] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/75 open:flex open:flex-col"
      style={{
        width: 'min(960px, 94vw)',
        height: 'min(92vh, 920px)',
        maxWidth: '94vw',
        margin: 'auto',
        padding: 0,
      }}
      aria-labelledby="edit-descriptions-title"
      onClose={close}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 id="edit-descriptions-title" className="text-base font-semibold text-slate-900">
            Edit descriptions
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Pick a sheet and change any start or end picture that needs a different description.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
        <label htmlFor="description-sheet" className="text-xs text-slate-500">
          Sheet
        </label>
        <select
          id="description-sheet"
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
          value={String(safeSheet)}
          onChange={(event) => setSheet(Number(event.target.value))}
        >
          {Array.from({ length: sheetCount }, (_, index) => (
            <option key={index} value={String(index)}>
              Sheet {index + 1} of {sheetCount}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {draft.slice(safeSheet * 10, safeSheet * 10 + 10).map((pair, localIndex) => {
          const index = safeSheet * 10 + localIndex;
          return (
            <div key={`${pair.sheetIndex}-${pair.pairIndex}-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">Pair {localIndex + 1}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Start</label>
                  <Input
                    value={pair.startSubject}
                    className="bg-white text-slate-900"
                    onChange={(event) => updatePair(index, { startSubject: event.target.value })}
                  />
                  <Textarea
                    rows={3}
                    value={pair.startDescription}
                    className="bg-white text-slate-900"
                    onChange={(event) => updatePair(index, { startDescription: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">End</label>
                  <Input
                    value={pair.endSubject}
                    className="bg-white text-slate-900"
                    onChange={(event) => updatePair(index, { endSubject: event.target.value })}
                  />
                  <Textarea
                    rows={3}
                    value={pair.endDescription}
                    className="bg-white text-slate-900"
                    onChange={(event) => updatePair(index, { endDescription: event.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSave(draft);
            close();
          }}
        >
          Save descriptions
        </Button>
      </div>
    </dialog>,
    document.body
  );
}
