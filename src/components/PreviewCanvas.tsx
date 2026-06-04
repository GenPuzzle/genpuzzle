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
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Validation Error Display */}
      {validationError && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{validationError.message}</p>
          </div>
        </div>
      )}

      {/* Two-Column Layout: PDF Preview (Left) + Controls (Right) */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        
        {/* LEFT SIDE: PDF Preview Area (70%) - Larger preview */}
        <div className="flex-[0.7] flex flex-col bg-white border-r" style={{borderColor: `#7D8183`}}>
          
          {/* PDF Content Area */}
          <div className="flex-1 overflow-auto flex justify-center items-start p-4 relative" style={{background: `linear-gradient(to br, #F0F5F6, #ffffff)`}}>
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
              <div className="relative bg-white rounded-xl shadow-xl border" style={{ width: '100%', height: '100%', maxWidth: 'none', borderColor: `#7D8183` }}>
                {isGeneratingPdf && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl z-50 backdrop-blur-sm">
                    <HoneycombLoader />
                  </div>
                )}
                {(() => {
                  let pdfUrl = `${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${previewZoom}`;
                  // If viewing solutions, navigate to the page where solutions start (after all puzzles)
                  if (activePreviewTab === 'solutions' && puzzlesToRender.length > 0) {
                    const solutionStartPage = puzzlesToRender.length + 1;
                    pdfUrl += `&page=${solutionStartPage}`;
                  }
                  return (
                    <iframe
                      key={`${previewPdfUrl}-${activePreviewTab}-${previewZoom}`}
                      src={pdfUrl}
                      className="w-full h-full border-0 rounded-xl"
                      title="PDF Preview"
                    />
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-4">
                <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium">Generate puzzles to see preview</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Controls Panel (30%) - Organized vertically */}
        <div className="flex-[0.3] flex flex-col overflow-y-auto" style={{background: `linear-gradient(to b, #F0F5F6, #ffffff)`}}>
          
          {/* Toolbar / Title */}
          <div className="border-b shadow-sm p-4" style={{background: `linear-gradient(to r, #2276B4, #1a5a8c)`, borderColor: `#7D8183`}}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 rounded-full" style={{background: `linear-gradient(to b, #2276B4, #1a5a8c)`}}></div>
              <h3 className="text-sm font-bold text-white">
                Preview Controls
              </h3>
            </div>
            {puzzlesToRender.length > 1 && (
              <span className="text-xs font-medium text-white px-2 py-1 rounded-full inline-block" style={{background: `rgba(34, 118, 180, 0.3)`}}>
                {puzzlesToRender.length} puzzles
              </span>
            )}
          </div>

          {/* Controls Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Preview Range Mode Toggle */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{color: `#7D8183`}}>Preview Range:</p>
              <div className="radio-inputs" style={{ width: '100%' }}>
                <div className="radio flex-1">
                  <input
                    type="radio"
                    id="preview-range-sample"
                    name="preview-range"
                    checked={previewRangeMode === 'sample'}
                    onChange={() => setPreviewRangeMode('sample')}
                    disabled={isGeneratingPdf}
                  />
                  <label htmlFor="preview-range-sample" className="name text-xs">
                    Sample (Fast)
                  </label>
                </div>
                <div className="radio flex-1">
                  <input
                    type="radio"
                    id="preview-range-all"
                    name="preview-range"
                    checked={previewRangeMode === 'all'}
                    onChange={handleToggleFullPageMode}
                    disabled={isGeneratingPdf || isGenerating}
                  />
                  <label htmlFor="preview-range-all" className="name text-xs">
                    All Pages
                  </label>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{background: `linear-gradient(to right, rgba(34, 118, 180, 0.2), rgba(34, 118, 180, 0.05), transparent)`}}></div>

            {/* Preview Content Tabs */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{color: `#7D8183`}}>Content Type:</p>
              <Tabs value={activePreviewTab} onValueChange={(v) => handleSwitchPreviewTab(v as 'puzzles' | 'solutions')}>
                <TabsList className="modern-tabs-list w-full">
                  <TabsTrigger value="puzzles" className="modern-tabs-trigger text-xs flex-1">Puzzles</TabsTrigger>
                  <TabsTrigger value="solutions" className="modern-tabs-trigger text-xs flex-1">Solutions</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Divider */}
            <div className="h-px" style={{background: `linear-gradient(to right, rgba(34, 118, 180, 0.2), rgba(34, 118, 180, 0.05), transparent)`}}></div>

            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="preview-zoom-slider" className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2" style={{color: `#7D8183`}}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color: `#2276B4`}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                  Zoom Level
                </label>
                <span className="text-sm font-bold text-white px-2 py-0.5 rounded" style={{background: `#2276B4`}}>{previewZoom}%</span>
              </div>
              <input
                id="preview-zoom-slider"
                type="range"
                min={25}
                max={150}
                value={previewZoom}
                onChange={(e) => setPreviewZoom(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #2276B4 0%, #2276B4 ${((previewZoom - 25) / 125) * 100}%, #F0F5F6 ${((previewZoom - 25) / 125) * 100}%, #F0F5F6 100%)`,
                }}
              />
            </div>

            {/* Divider */}
            <div className="h-px" style={{background: `linear-gradient(to right, rgba(34, 118, 180, 0.2), rgba(34, 118, 180, 0.05), transparent)`}}></div>

            {/* Info Text */}
            <div className="text-xs px-3 py-2 rounded-lg border" style={{color: `#7D8183`, background: `rgba(34, 118, 180, 0.05)`, borderColor: `rgba(34, 118, 180, 0.2)`}}>
              {previewRangeMode === 'sample' ? (
                <span>📄 <strong>Sample Mode:</strong> Showing first puzzle only for fast editing</span>
              ) : (
                <span>📚 <strong>Full Mode:</strong> Showing all {puzzlesToRender.length} puzzles in complete document</span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button 
                size="sm" 
                onClick={handleGeneratePuzzlesWithLoading} 
                disabled={isGeneratingPdf || isGenerating}
                className="w-full text-white shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{background: `linear-gradient(to r, #2276B4, #1a5a8c)`}}
              >
                Generate {wordSearchSettings?.core?.numberOfPuzzles || 1}
              </Button>
              <Button 
                size="sm" 
                onClick={handleExportPDFWithLoading} 
                disabled={isGeneratingPdf || isGenerating}
                className="w-full text-white shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{background: `linear-gradient(to r, #7D8183, #5a5f61)`}}
              >
                <Download className="w-4 h-4 mr-1" />
                Export PDF
              </Button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
