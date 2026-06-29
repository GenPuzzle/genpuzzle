'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/lib/app-context';
import {
  downloadGpProject,
  GP_FILE_EXTENSION,
  readGpProjectFromFile,
} from '@/lib/project-file';
import { exportBookAsPdf, exportBookAsPpt, canExportBook } from '@/lib/book-export-actions';
import { useBookExportInput } from '@/hooks/useBookExportInput';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { toast } from 'sonner';
import {
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Presentation,
  Save,
  Share2,
} from 'lucide-react';

type PendingAction = 'new' | 'open' | null;

interface AppFileMenuProps {
  onShare: () => void;
  shareEnabled?: boolean;
}

export function AppFileMenu({ onShare, shareEnabled = false }: AppFileMenuProps) {
  const app = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);

  const exportInput = useBookExportInput();

  const handleSaveProject = useCallback(() => {
    if (app.documentPages.length === 0) {
      toast.error('Add a document before saving your project');
      return;
    }
    const snapshot = app.buildProjectSnapshot();
    downloadGpProject(snapshot);
    app.markProjectSaved();
    toast.success('Project saved');
  }, [app]);

  const hasDocuments = app.documentPages.length > 0;
  const exportEnabled = canExportBook(exportInput);

  const runNewProject = useCallback(() => {
    app.resetToNewProject();
    toast.success('New project created');
  }, [app]);

  const requestNewProject = useCallback(() => {
    setMenuOpen(false);
    if (app.isProjectDirty && app.documentPages.length > 0) {
      setPendingAction('new');
      setUnsavedDialogOpen(true);
      return;
    }
    runNewProject();
  }, [app.isProjectDirty, app.documentPages.length, runNewProject]);

  const requestOpenProject = useCallback(() => {
    setMenuOpen(false);
    if (app.isProjectDirty && app.documentPages.length > 0) {
      setPendingAction('open');
      setUnsavedDialogOpen(true);
      return;
    }
    fileInputRef.current?.click();
  }, [app.isProjectDirty, app.documentPages.length]);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const project = await readGpProjectFromFile(file);
      app.loadProjectSnapshot(project);
      toast.success(`Opened "${project.projectName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open project');
    }
  };

  const handleUnsavedSave = async () => {
    handleSaveProject();
    if (pendingAction === 'new') {
      runNewProject();
    } else if (pendingAction === 'open') {
      fileInputRef.current?.click();
    }
    setPendingAction(null);
  };

  const handleUnsavedDiscard = () => {
    if (pendingAction === 'new') {
      runNewProject();
    } else if (pendingAction === 'open') {
      fileInputRef.current?.click();
    }
    setPendingAction(null);
  };

  const handleExportPdf = async () => {
    setMenuOpen(false);
    setExportingPdf(true);
    try {
      await exportBookAsPdf(exportInput, app.projectName);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportPpt = async () => {
    setMenuOpen(false);
    setExportingPpt(true);
    try {
      await exportBookAsPpt(exportInput, (status) => toast.loading(status, { id: 'ppt-export' }), app.projectName);
      toast.dismiss('ppt-export');
      toast.success('PowerPoint saved');
    } catch (error) {
      toast.dismiss('ppt-export');
      toast.error(error instanceof Error ? error.message : 'PPT export failed');
    } finally {
      setExportingPpt(false);
    }
  };

  const handleShare = () => {
    if (!shareEnabled) {
      toast.error('Add words, text, or puzzles before sharing your project');
      return;
    }
    setMenuOpen(false);
    onShare();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={GP_FILE_EXTENSION}
        className="hidden"
        onChange={handleFileSelected}
      />

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <HeaderExpandButton
            expandSize="sm"
            label="File"
            icon={<FileText className="h-3.5 w-3.5" strokeWidth={2.25} />}
            aria-label="File menu"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={requestNewProject}>
            <FilePlus2 className="h-4 w-4" />
            New project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={requestOpenProject}>
            <FolderOpen className="h-4 w-4" />
            Open project…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSaveProject} disabled={!hasDocuments}>
            <Save className="h-4 w-4" />
            Save project{GP_FILE_EXTENSION}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleExportPdf}
            disabled={!exportEnabled || exportingPdf}
          >
            <FileDown className="h-4 w-4" />
            {exportingPdf ? 'Exporting PDF…' : 'Download as PDF'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExportPpt}
            disabled={!exportEnabled || exportingPpt}
          >
            <Presentation className="h-4 w-4" />
            {exportingPpt ? 'Saving PPT…' : 'Save as PPT'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleShare}
            disabled={!shareEnabled}
            className={!shareEnabled ? 'opacity-50' : undefined}
          >
            <Share2 className="h-4 w-4" />
            Share project link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onOpenChange={(open) => {
          setUnsavedDialogOpen(open);
          if (!open) setPendingAction(null);
        }}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        title="Save your work?"
        description="You have unsaved changes. Save before starting a new project or opening another file?"
      />
    </>
  );
}
