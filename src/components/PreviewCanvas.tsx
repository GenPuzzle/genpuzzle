'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '@/lib/app-context';
import { Eye, EyeOff, Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { generatePuzzlePDF, downloadPDF } from '@/lib/pdf-export';
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { HoneycombLoader } from './HoneycombLoader';

export function PreviewCanvas() {
  const {
    currentPuzzle,
    currentPuzzleType,
    showSolution,
    setShowSolution,
    titleWords,
    wordSearchSettings,
    batchPuzzles,
    currentBatchIndex,
    setCurrentBatchIndex,
    generatePuzzle,
    bookSettings,
    previewZoom,
    setPreviewZoom,
    puzzleGridScale,
    pageOverrides,
    applyMode,
    titleToAnswerGap,
    pageMargin,
    validationError,
    previewRangeMode,
    setPreviewRangeMode,
    activePreviewTab,
    setActivePreviewTab,
  } = useApp();

  const [previewPdfUrl, setPreviewPdfUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfUrlRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Strict conditional slicing logic for performance optimization
  const puzzlesToRender = React.useMemo(() => {
    if (previewRangeMode === 'sample') {
      // Sample mode: only render first puzzle (fast editing)
      return batchPuzzles.length > 0 ? [batchPuzzles[0]] : [];
    } else {
      // All mode: render all puzzles (full document)
      return batchPuzzles;
    }
  }, [previewRangeMode, batchPuzzles]);

  // Debounced PDF generation hook - 300ms debounce for sample mode, no debounce for all mode
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Use shorter debounce (100ms) for sample mode for instant updates
    const debounceMs = previewRangeMode === 'sample' ? 100 : 300;

    debounceTimerRef.current = setTimeout(() => {
      const generatePreviewPdf = async () => {
        if (currentPuzzleType !== 'word-search') return;
        if (puzzlesToRender.length === 0 && !currentPuzzle) return;

        setIsGeneratingPdf(true);
        try {
          const pdfData = await generatePuzzlePDF({
            bookSettings: {
              ...bookSettings,
              ...wordSearchSettings.bookCanvas,
            },
            titleWords,
            wordSearchSettings,
            puzzles: puzzlesToRender,
            includeSolution: activePreviewTab === 'solutions',
            onlySolutions: activePreviewTab === 'solutions',
            puzzleGridScale,
            titleToAnswerGap,
            pageMargin,
            pageOverrides,
            applyMode,
          });

          // Convert PDF bytes to Blob URL
          const blob = new Blob([pdfData], { type: 'application/pdf' });
          const newPdfUrl = URL.createObjectURL(blob);

          // Revoke old URL to prevent memory leaks
          if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current);
          }

          pdfUrlRef.current = newPdfUrl;
          setPreviewPdfUrl(newPdfUrl);
        } catch (error) {
          console.error('Failed to generate preview PDF:', error);
        } finally {
          setIsGeneratingPdf(false);
        }
      };

      generatePreviewPdf();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    currentPuzzleType,
    currentPuzzle,
    puzzlesToRender,
    bookSettings,
    titleWords,
    wordSearchSettings,
    puzzleGridScale,
    titleToAnswerGap,
    pageMargin,
    activePreviewTab,
    pageOverrides,
    applyMode,
  ]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
    };
  }, []);

  const displayTitle = titleWords.title || 'Puzzle Preview';

  const handleExportPDF = async () => {
    if (currentPuzzleType === 'word-search' && batchPuzzles.length > 0) {
      try {
        const pdfData = await generatePuzzlePDF({
          bookSettings: {
            ...bookSettings,
            ...wordSearchSettings.bookCanvas,
          },
          titleWords,
          wordSearchSettings,
          puzzles: batchPuzzles,
          includeSolution: true,
          onlySolutions: false,
          puzzleGridScale,
          titleToAnswerGap,
          pageMargin,
          pageOverrides,
          applyMode,
        });
        downloadPDF(pdfData, `${titleWords.title || 'word-search'}-${Date.now()}.pdf`);
      } catch (error) {
        alert('Failed to export PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } else if (currentPuzzle) {
      try {
        const pdfData = await generatePuzzlePDF({
          bookSettings: {
            ...bookSettings,
            ...wordSearchSettings.bookCanvas,
          },
          titleWords,
          wordSearchSettings,
          puzzles: [currentPuzzle as WordSearchPuzzle],
          includeSolution: true,
          onlySolutions: false,
          puzzleGridScale,
          titleToAnswerGap,
          pageMargin,
          pageOverrides,
          applyMode,
        });
        downloadPDF(pdfData, `${titleWords.title || 'puzzle'}-${Date.now()}.pdf`);
      } catch (error) {
        alert('Failed to export PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  // 3-Step Asynchronous Flow: Instant UI Activation → Paint → PDF Pipeline
  const handleToggleFullPageMode = async () => {
    // STEP 1: Instant UI State Activation (Synchronous)
    // Update the active mode state FIRST to change button visual style immediately
    setPreviewRangeMode('all');
    // Then activate the loader SECOND
    setIsGenerating(true);

    // STEP 2: Yield the Thread to Let HTML/CSS Paint (Micro-task Delay)
    // Force browser to paint the newly updated button state and start playing spinner animation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // STEP 3: Execute PDF Pipeline and Persistent Loading Closure
    // Invoke the heavy PDF compilation in a deferred macro-task
    setTimeout(() => {
      try {
        // PDF generation is already happening via useEffect watching previewRangeMode changes
        // The debounce timer will trigger the generatePreviewPdf function automatically
      } catch (error) {
        console.error(error);
      } finally {
        // CRUCIAL: Do not turn off the loader until the PDF rendering target has fully updated
        // Add a safety margin to ensure the PDF component is drawing on screen before removing overlay
        setTimeout(() => {
          setIsGenerating(false);
        }, 300);
      }
    }, 0);
  };

  // 3-Step Asynchronous Flow: Instant UI Activation → Paint → PDF Pipeline
  const handleSwitchPreviewTab = async (tab: 'puzzles' | 'solutions') => {
    // STEP 1: Instant UI State Activation (Synchronous)
    // Update the active tab state FIRST to change button visual style immediately
    setActivePreviewTab(tab);
    // Then activate the loader SECOND
    setIsGenerating(true);

    // STEP 2: Yield the Thread to Let HTML/CSS Paint (Micro-task Delay)
    // Force browser to paint the newly updated tab button state and start playing spinner animation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // STEP 3: Execute PDF Pipeline and Persistent Loading Closure
    // Invoke the heavy PDF compilation in a deferred macro-task
    setTimeout(() => {
      try {
        // PDF generation is already happening via useEffect watching activePreviewTab changes
        // The debounce timer will trigger the generatePreviewPdf function automatically
      } catch (error) {
        console.error(error);
      } finally {
        // CRUCIAL: Do not turn off the loader until the PDF rendering target has fully updated
        // Add a safety margin to ensure the PDF component is drawing on screen before removing overlay
        setTimeout(() => {
          setIsGenerating(false);
        }, 300);
      }
    }, 0);
  };

  // Strict 3-Step Lifecycle: Instant Activation → Rendering Pause → Deferred Generation
  const handleGeneratePuzzlesWithLoading = async () => {
    // STEP 1: Instant Activation & Animation Mount (Synchronous)
    // The moment the user clicks "Generate Puzzles", inject the HTML/CSS markup immediately
    setIsGenerating(true);

    // STEP 2: Enforce a Rendering Pause (Yield to the Browser Layout Thread)
    // Grant a 400ms window for the flipping pages animation to run fluidly
    // This prevents CPU-intensive puzzle generation from freezing the animation
    await new Promise((resolve) => setTimeout(resolve, 400));

    // STEP 3: Deferred Async Puzzle Generation & Complete PDF Mount
    // Wrap the entire puzzle generation algorithm inside a deferred timeout block
    setTimeout(() => {
      try {
        // >>> 1. RUN YOUR INTENSIVE PUZZLE GENERATION LOGIC HERE <<<
        generatePuzzle();
        // >>> 2. PDF SOURCE STATE UPDATES ARE HANDLED BY useEffect watching dependencies <<<
      } catch (error) {
        console.error('Generation failed:', error);
      } finally {
        // >>> 3. PERSISTENT CLOSURE <<<
        // Do NOT turn off the animation immediately. Wait 500ms to ensure 
        // the compiled PDF data is fully mounted and painting on the screen UI.
        setTimeout(() => {
          setIsGenerating(false);
        }, 500);
      }
    }, 0);
  };

  // 3-Step Asynchronous Flow: Instant UI Activation → Paint → PDF Pipeline
  const handleExportPDFWithLoading = async () => {
    // STEP 1: Instant UI State Activation (Synchronous)
    // Activate the loader immediately
    setIsGenerating(true);

    // STEP 2: Yield the Thread to Let HTML/CSS Paint (Micro-task Delay)
    // Force browser to start playing spinner animation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // STEP 3: Execute PDF Pipeline and Persistent Loading Closure
    // Invoke the heavy PDF export in a deferred macro-task
    setTimeout(async () => {
      try {
        await handleExportPDF();
      } catch (error) {
        console.error(error);
      } finally {
        // CRUCIAL: Do not turn off the loader until the PDF rendering target has fully updated
        // Add a safety margin to ensure the PDF component is drawing on screen before removing overlay
        setTimeout(() => {
          setIsGenerating(false);
        }, 300);
      }
    }, 0);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
      {/* Performance Mode Controls */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Preview Range Mode Toggle - Custom Radio Buttons */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Preview Range:</span>
            <div className="radio-buttons-container">
              <label className="radio-button">
                <input
                  type="radio"
                  name="preview-range"
                  className="radio-button__input"
                  checked={previewRangeMode === 'sample'}
                  onChange={() => setPreviewRangeMode('sample')}
                  disabled={isGeneratingPdf}
                />
                <span className="radio-button__label">
                  Sample Pages (Fast)
                  <span className="radio-button__custom" />
                </span>
              </label>
              <label className="radio-button">
                <input
                  type="radio"
                  name="preview-range"
                  className="radio-button__input"
                  checked={previewRangeMode === 'all'}
                  onChange={handleToggleFullPageMode}
                  disabled={isGeneratingPdf || isGenerating}
                />
                <span className="radio-button__label">
                  All Pages (Full)
                  <span className="radio-button__custom" />
                </span>
              </label>
            </div>
          </div>

          {/* Preview Content Tabs */}
          <Tabs value={activePreviewTab} onValueChange={(v) => handleSwitchPreviewTab(v as 'puzzles' | 'solutions')}>
            <TabsList>
              <TabsTrigger value="puzzles" className="text-xs">Puzzle Sheets</TabsTrigger>
              <TabsTrigger value="solutions" className="text-xs">Solution Sheets</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Info Text */}
          <div className="text-xs text-gray-500">
            {previewRangeMode === 'sample' ? (
              <span>Showing first puzzle only • Instant updates for fast editing</span>
            ) : (
              <span>Showing all {puzzlesToRender.length} puzzles • Full document preview</span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-gray-900">
            {displayTitle}
            {puzzlesToRender.length > 1 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({puzzlesToRender.length} puzzles in preview)
              </span>
            )}
          </h2>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-lg">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
            <label htmlFor="preview-zoom-slider" className="text-sm text-gray-600 whitespace-nowrap">
              Preview Zoom
            </label>
            <input
              id="preview-zoom-slider"
              type="range"
              min={25}
              max={150}
              value={previewZoom}
              onChange={(e) => setPreviewZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-900">{previewZoom}%</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleGeneratePuzzlesWithLoading} disabled={isGeneratingPdf || isGenerating}>
              Generate {wordSearchSettings?.core?.numberOfPuzzles || 1} {(wordSearchSettings?.core?.numberOfPuzzles || 1) === 1 ? 'Puzzle' : 'Puzzles'}
            </Button>
            <Button size="sm" onClick={handleExportPDFWithLoading} disabled={isGeneratingPdf || isGenerating}>
              <Download className="w-4 h-4 mr-1" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Validation Error Display */}
      {validationError && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{validationError.message}</p>
          </div>
        </div>
      )}

      {/* PDF Preview Area — Real-time WYSIWYG with iframe streaming */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-gray-100 relative">
        {/* Non-blocking loading overlay with 3D rotating spinner */}
        {isGenerating && (
          <div className="absolute inset-0 z-[9999] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto">
            <div className="spinner">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        )}
        {previewPdfUrl && !isGenerating ? (
          <div className="relative bg-white rounded-lg shadow-lg" style={{ width: 'fit-content', maxWidth: '95%' }}>
            {isGeneratingPdf && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg z-50 backdrop-blur-sm">
                <HoneycombLoader />
              </div>
            )}
            {(() => {
              let pdfUrl = `${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=${previewZoom}`;
              // If viewing solutions, navigate to the page where solutions start (after all puzzles)
              if (activePreviewTab === 'solutions' && puzzlesToRender.length > 0) {
                const solutionStartPage = puzzlesToRender.length + 1;
                pdfUrl += `&page=${solutionStartPage}`;
              }
              return (
                <iframe
                  key={`${previewPdfUrl}-${activePreviewTab}-${previewZoom}`}
                  src={pdfUrl}
                  className="w-full h-full border-0 rounded-lg"
                  style={{ minHeight: '750px', minWidth: '600px' }}
                  title="PDF Preview"
                />
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-lg">Generate puzzles to see preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
