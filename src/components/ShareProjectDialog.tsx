'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Link2, Mail, Share2 } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';
import { toast } from 'sonner';

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  projectName: string;
}

export function ShareProjectDialog({
  open,
  onOpenChange,
  shareUrl,
  projectName,
}: ShareProjectDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const encodedShareText = useMemo(
    () => encodeURIComponent(`Check out my puzzle book project: ${projectName}`),
    [projectName]
  );
  const encodedUrl = useMemo(() => encodeURIComponent(shareUrl), [shareUrl]);

  const socialLinks = useMemo(
    () => [
      {
        label: 'X (Twitter)',
        href: `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedUrl}`,
      },
      {
        label: 'Facebook',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      },
      {
        label: 'LinkedIn',
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      },
      {
        label: 'Email',
        href: `mailto:?subject=${encodeURIComponent(projectName)}&body=${encodedShareText}%0A%0A${encodedUrl}`,
      },
    ],
    [encodedShareText, encodedUrl, projectName]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Project link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (!mounted || !open) return null;

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
          className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-lg bg-white text-left shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={() => onOpenChange(false)} />

          <div className="px-5 pb-5 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gp-grey-100)]">
                <Share2 className="h-5 w-5 text-[var(--gp-blue)]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--gp-blue-dark)]">Share project</h2>
                <p className="text-sm text-slate-600">Copy the link or share on social media.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--gp-blue)] hover:bg-[var(--gp-blue-dark)]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Anyone with this link can open your project in GenPuzzle. Large projects may need a .gp file
              instead.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-[var(--gp-blue)] hover:bg-[var(--gp-grey-50)]"
                >
                  {link.label === 'Email' ? <Mail className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
