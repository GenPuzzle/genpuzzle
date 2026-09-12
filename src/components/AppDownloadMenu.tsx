'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { useBookExportInput } from '@/hooks/useBookExportInput';
import { useApp } from '@/lib/app-context';
import { useOptionalAppBusy } from '@/lib/app-busy-context';
import { progressFromStatus, startSoftProgress } from '@/lib/busy-progress';
import { canExportBook, exportBookAsPdf, exportBookAsPpt } from '@/lib/book-export-actions';
import { downloadGpProject } from '@/lib/project-file';
import { Download, FileDown, Presentation, Save } from 'lucide-react';
import { toast } from 'sonner';

export function AppDownloadMenu() {
  const app = useApp();
  const { showBusy, updateBusy, hideBusy } = useOptionalAppBusy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);
  const [exportingGp, setExportingGp] = useState(false);

  const exportInput = useBookExportInput();
  const exportEnabled = canExportBook(exportInput);
  const hasDocuments = app.documentPages.length > 0;
  const downloadDisabled = !exportEnabled && !hasDocuments;

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

  const handleExportGp = async () => {
    setMenuOpen(false);
    if (!hasDocuments) {
      toast.error('Add a document before saving your project');
      return;
    }
    setExportingGp(true);
    showBusy('Saving project (.gp)…', 12);
    const stopSoft = startSoftProgress((p) => updateBusy({ progress: p }), {
      start: 12,
      cap: 95,
      stepMs: 40,
      step: 10,
    });
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          const snapshot = app.buildProjectSnapshot();
          downloadGpProject(snapshot);
          app.markProjectSaved();
          resolve();
        });
      });
      stopSoft();
      toast.success('Project saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      stopSoft();
      hideBusy();
      setExportingGp(false);
    }
  };

  const busyExport = exportingPdf || exportingPpt || exportingGp;

  return (
    <DropdownMenu open={menuOpen} onOpenChange={(open) => !downloadDisabled && setMenuOpen(open)}>
      <DropdownMenuTrigger asChild disabled={downloadDisabled}>
        <HeaderExpandButton
          expandSize="md"
          label="Download"
          icon={<Download className="h-3.5 w-3.5" strokeWidth={2.25} />}
          aria-label="Download"
          disabled={downloadDisabled}
          title={downloadDisabled ? 'Add a document before downloading' : 'Download'}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-[100]">
        <DropdownMenuCheckboxItem
          checked={Boolean(app.bookSettings.mixPuzzles)}
          onCheckedChange={(checked) =>
            app.setBookSettings({ ...app.bookSettings, mixPuzzles: checked === true })
          }
          onSelect={(event) => event.preventDefault()}
        >
          Mix the puzzles
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleExportPdf}
          disabled={!exportEnabled || busyExport}
        >
          <FileDown className="h-4 w-4" />
          {exportingPdf ? 'Exporting PDF…' : 'PDF'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportPpt}
          disabled={!exportEnabled || busyExport}
        >
          <Presentation className="h-4 w-4" />
          {exportingPpt ? 'Exporting PPT…' : 'PPT'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportGp} disabled={!hasDocuments || busyExport}>
          <Save className="h-4 w-4" />
          {exportingGp ? 'Saving GP…' : 'GP project'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
