'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Monitor, Sparkles } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';
import { toast } from '@/hooks/use-toast';

interface AddImageSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelected: (dataUrl: string) => void;
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export function AddImageSourceDialog({
  open,
  onOpenChange,
  onImageSelected,
}: AddImageSourceDialogProps) {
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  const handleAiClick = () => {
    toast({
      title: 'Coming soon',
      description: 'AI image generation will be available in a future update.',
    });
  };

  const handlePcClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please choose an image file (JPG, PNG, GIF, WebP, etc.).',
        variant: 'destructive',
      });
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      onImageSelected(dataUrl);
      onOpenChange(false);
    } catch {
      toast({
        title: 'Upload failed',
        description: 'Could not read the selected image. Please try another file.',
        variant: 'destructive',
      });
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-image-source-title"
          className="add-image-source-dialog pointer-events-auto relative w-full max-w-[360px] overflow-hidden rounded-lg bg-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15),0_10px_10px_-5px_rgba(0,0,0,0.08)]"
          onClick={(event) => event.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={() => onOpenChange(false)} />

          <div className="px-5 pb-2 pt-5">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--gp-grey-100)]">
              <ImagePlus className="h-6 w-6 text-[var(--gp-blue)]" strokeWidth={1.75} />
            </div>
            <h2
              id="add-image-source-title"
              className="mt-3 text-center text-base font-semibold text-[var(--gp-blue-dark)]"
            >
              Add image
            </h2>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              Choose how you want to add an image to the page.
            </p>
          </div>

          <div className="space-y-2.5 px-5 pb-5 pt-2">
            <button type="button" className="add-image-source-option" onClick={handleAiClick}>
              <span className="add-image-source-option__icon add-image-source-option__icon--ai">
                <Sparkles className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="add-image-source-option__copy">
                <span className="add-image-source-option__title">
                  AI generated
                  <span className="add-image-source-option__badge">Soon</span>
                </span>
                <span className="add-image-source-option__hint">
                  Create an image with AI (API coming later)
                </span>
              </span>
            </button>

            <button type="button" className="add-image-source-option" onClick={handlePcClick}>
              <span className="add-image-source-option__icon add-image-source-option__icon--pc">
                <Monitor className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="add-image-source-option__copy">
                <span className="add-image-source-option__title">From your computer</span>
                <span className="add-image-source-option__hint">
                  Upload JPG, PNG, GIF, or WebP from your device
                </span>
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
