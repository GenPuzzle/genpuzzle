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
import { useOptionalAppBusy } from '@/lib/app-busy-context';
import { progressFromStatus, startSoftProgress } from '@/lib/busy-progress';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { NewProjectChoiceDialog } from '@/components/ai/NewProjectChoiceDialog';
import { AiProjectWizard } from '@/components/ai/AiProjectWizard';
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
  const { showBusy, updateBusy, hideBusy } = useOptionalAppBusy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);

  const exportInput = useBookExportInput();

  const handleSaveProject = useCallback(() => {
    if (app.documentPages.length === 0) {
      toast.error('Add a document before saving your project');
      return;
    }
    showBusy('Saving project…', 10);
    const stopSoft = startSoftProgress((p) => updateBusy({ progress: p }), {
      start: 10,
      cap: 95,
      stepMs: 40,
      step: 12,
    });
    try {
      const snapshot = app.buildProjectSnapshot();
      downloadGpProject(snapshot);
      app.markProjectSaved();
      stopSoft();
      toast.success('Project saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      stopSoft();
      // Brief beat so the bar is visible on fast saves.
      window.setTimeout(() => hideBusy(), 180);
    }
  }, [app, showBusy, updateBusy, hideBusy]);

  const hasDocuments = app.documentPages.length > 0;
  const exportEnabled = canExportBook(exportInput);

  const runManualNewProject = useCallback(() => {
    app.resetToNewProject();
    toast.success('New project created');
  }, [app]);

  const openNewProjectChoice = useCallback(() => {
    setChoiceOpen(true);
  }, []);

  const requestNewProject = useCallback(() => {
    setMenuOpen(false);
    if (app.isProjectDirty && app.documentPages.length > 0) {
      setPendingAction('new');
      setUnsavedDialogOpen(true);
      return;
    }
    openNewProjectChoice();
  }, [app.isProjectDirty, app.documentPages.length, openNewProjectChoice]);

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

    showBusy(`Opening “${file.name}”…`, 8);
    const stopSoft = startSoftProgress((p) => updateBusy({ progress: p }), {
      start: 8,
      cap: 88,
      stepMs: 90,
      step: 6,
    });
    try {
      const project = await readGpProjectFromFile(file);
      updateBusy({ label: 'Loading project…', progress: 92 });
      app.loadProjectSnapshot(project);
      stopSoft();
      toast.success(`Opened "${project.projectName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open project');
    } finally {
      stopSoft();
      hideBusy();
    }
  };

  const handleUnsavedSave = async () => {
    handleSaveProject();
    if (pendingAction === 'new') {
      openNewProjectChoice();
    } else if (pendingAction === 'open') {
      fileInputRef.current?.click();
    }
    setPendingAction(null);
  };

  const handleUnsavedDiscard = () => {
    if (pendingAction === 'new') {
      openNewProjectChoice();
    } else if (pendingAction === 'open') {
      fileInputRef.current?.click();
    }
    setPendingAction(null);
  };

  const handleExportPdf = async () => {
    setMenuOpen(false);
    setExportingPdf(true);
    showBusy('Exporting PDF…', 4);
    try {
      await exportBookAsPdf(exportInput, app.projectName, (status) => {
        const progress = progressFromStatus(status);
        updateBusy({
          label: status,
          ...(progress !== undefined ? { progress } : {}),
        });
      });
      updateBusy({ label: 'PDF ready', progress: 100 });
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF export failed');
    } finally {
      hideBusy();
      setExportingPdf(false);
    }
  };

  const handleExportPpt = async () => {
    setMenuOpen(false);
    setExportingPpt(true);
    showBusy('Exporting PowerPoint…', 4);
    try {
      await exportBookAsPpt(
        exportInput,
        (status) => {
          const progress = progressFromStatus(status);
          updateBusy({
            label: status,
            ...(progress !== undefined ? { progress } : {}),
          });
        },
        app.projectName
      );
      updateBusy({ label: 'PowerPoint ready', progress: 100 });
      toast.success('PowerPoint saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PPT export failed');
    } finally {
      hideBusy();
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
            Save project
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

      <NewProjectChoiceDialog
        open={choiceOpen}
        onOpenChange={setChoiceOpen}
        onChooseManual={runManualNewProject}
        onChooseAi={() => setAiWizardOpen(true)}
      />

      <AiProjectWizard
        open={aiWizardOpen}
        onClose={() => setAiWizardOpen(false)}
        onComplete={() => {
          /* already in editor */
        }}
      />
    </>
  );
}
