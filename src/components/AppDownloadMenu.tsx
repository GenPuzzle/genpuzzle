'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { useBookExportInput } from '@/hooks/useBookExportInput';
import { useApp } from '@/lib/app-context';
import { canExportBook, exportBookAsPdf, exportBookAsPpt } from '@/lib/book-export-actions';
import { Download, FileDown, Presentation } from 'lucide-react';
import { toast } from 'sonner';

export function AppDownloadMenu() {
  const app = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);

  const exportInput = useBookExportInput();
  const exportEnabled = canExportBook(exportInput);
  const downloadDisabled = !exportEnabled;

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
      await exportBookAsPpt(
        exportInput,
        (status) => toast.loading(status, { id: 'header-ppt-export' }),
        app.projectName
      );
      toast.dismiss('header-ppt-export');
      toast.success('PowerPoint saved');
    } catch (error) {
      toast.dismiss('header-ppt-export');
      toast.error(error instanceof Error ? error.message : 'PPT export failed');
    } finally {
      setExportingPpt(false);
    }
  };

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
      <DropdownMenuContent align="end" className="w-48 z-[100]">
        <DropdownMenuItem
          onClick={handleExportPdf}
          disabled={!exportEnabled || exportingPdf || exportingPpt}
        >
          <FileDown className="h-4 w-4" />
          {exportingPdf ? 'Exporting PDF…' : 'PDF'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportPpt}
          disabled={!exportEnabled || exportingPdf || exportingPpt}
        >
          <Presentation className="h-4 w-4" />
          {exportingPpt ? 'Exporting PPT…' : 'PPT'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
