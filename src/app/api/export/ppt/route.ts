import { NextRequest, NextResponse } from 'next/server';
import { ExportOptions, generatePuzzlePPTBlob } from '@/lib/ppt-export';

/**
 * API route for PPT export (server-side).
 * Handles pptxgenjs bundling on the server to avoid client-side issues.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[PPT API] Received PPT export request');
    const options: ExportOptions = await request.json();
    
    console.log('[PPT API] Options:', {
      hasBookSettings: !!options.bookSettings,
      hasTitleWords: !!options.titleWords,
      hasWordSearchSettings: !!options.wordSearchSettings,
      puzzlesCount: options.puzzles?.length || 0,
      includeSolution: options.includeSolution,
    });
    
    // Generate the PPT blob on server
    console.log('[PPT API] Calling generatePuzzlePPTBlob...');
    const blob = await generatePuzzlePPTBlob(options);
    
    if (!blob) {
      console.error('[PPT API] generatePuzzlePPTBlob returned null');
      return NextResponse.json(
        { error: 'Failed to generate PPT' },
        { status: 500 }
      );
    }

    // Convert blob to base64 for transmission
    console.log('[PPT API] Converting blob to base64...');
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const fileName = options.titleWords?.title || 'word-search';

    console.log('[PPT API] Export successful, returning base64 data');
    return NextResponse.json({
      success: true,
      data: base64,
      fileName,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[PPT API] Export failed:', errorMessage);
    console.error('[PPT API] Stack:', errorStack);
    return NextResponse.json(
      { error: `PPT export failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
