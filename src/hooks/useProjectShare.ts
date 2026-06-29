'use client';

import { useCallback, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useBookExportInput } from '@/hooks/useBookExportInput';
import { canShareProject } from '@/lib/book-export-actions';
import { buildShareUrl } from '@/lib/project-file';
import { toast } from 'sonner';

export function useProjectShare() {
  const app = useApp();
  const exportInput = useBookExportInput();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const shareEnabled = canShareProject(exportInput);

  const openShareDialog = useCallback(() => {
    if (!shareEnabled) {
      toast.error('Add words, text, or puzzles before sharing your project');
      return;
    }
    try {
      const snapshot = app.buildProjectSnapshot();
      setShareUrl(buildShareUrl(snapshot));
      setShareDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create share link');
    }
  }, [app, shareEnabled]);

  return {
    shareDialogOpen,
    setShareDialogOpen,
    shareUrl,
    openShareDialog,
    shareEnabled,
    projectName: app.projectName,
  };
}
