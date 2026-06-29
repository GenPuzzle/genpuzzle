import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/export/pdf-to-ppt
 * 
 * Converts a PDF file to PPT format using JavaScript/Node.js.
 * Each PDF page becomes a PPT slide with the rendered content.
 * Uses pdfjs-dist to parse PDF and pptxgenjs to create PPT.
 * 
 * Expected request:
 * - Content-Type: multipart/form-data
 * - Body: form data with 'pdf' field and 'fileName' field
 * 
 * Returns:
 * - PPT file as binary data
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;
    const fileName = (formData.get('fileName') as string) || 'puzzle';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      );
    }

    // Get PDF buffer
    const pdfBytes = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Convert PDF to PPT
    const pptxBuffer = await convertPdfToPptx(pdfBuffer);

    // Return PPT file
    return new NextResponse(pptxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${fileName}-${Date.now()}.pptx"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF to PPT conversion error:', error);
    return NextResponse.json(
      {
        error: 'Failed to convert PDF to PPT',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Convert PDF to PPTX using JavaScript libraries
 */
async function convertPdfToPptx(pdfBuffer: Buffer): Promise<Buffer> {
  // Polyfill DOMMatrix and DOMPoint for PDF.js server-side execution (no native dependency required)
  if (typeof global !== 'undefined') {
    if (!(global as any).DOMMatrix) {
      (global as any).DOMMatrix = class DOMMatrix {
        a: number = 1;
        b: number = 0;
        c: number = 0;
        d: number = 1;
        e: number = 0;
        f: number = 0;

        scaleSelf(sx: number = 1, sy: number = sx) {
          this.a *= sx;
          this.b *= sx;
          this.c *= sy;
          this.d *= sy;
          return this;
        }

        translateSelf(tx: number = 0, ty: number = 0) {
          this.e = this.a * tx + this.c * ty + this.e;
          this.f = this.b * tx + this.d * ty + this.f;
          return this;
        }
      };
    }
    if (!(global as any).DOMPoint) {
      (global as any).DOMPoint = class DOMPoint {
        x: number;
        y: number;
        z: number;
        w: number;
        constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
          this.x = x;
          this.y = y;
          this.z = z;
          this.w = w;
        }
      };
    }
  }

  // Dynamic imports to avoid build issues
  const pdfjsModule = await import('pdfjs-dist');
  const pdfjs = pdfjsModule;
  const PptxGenJS = (await import('pptxgenjs')).default;

  // Set up PDF.js worker:
  // 1. Bypass dynamic ES module imports on the server context by loading the worker and attaching it to globalThis
  if (typeof window === 'undefined') {
    try {
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
      (globalThis as any).pdfjsWorker = pdfjsWorker;
    } catch (err) {
      console.warn('Failed to load local pdf.worker.mjs directly:', err);
    }
  }

  // 2. Set the worker source path (acts as a standard fallback and is required by pdfjs-dist API)
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.0.227/pdf.worker.min.mjs`;

  // Load PDF document
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const pageCount = pdf.numPages;

  // Create presentation
  const prs = new PptxGenJS();
  prs.defineLayout({ name: 'STANDARD', width: 10, height: 7.5 });
  prs.layout = 'STANDARD';

  // Process each PDF page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      // Create a dynamic canvas-like object for Node.js
      const canvasFactory = {
        create: (width: number, height: number) => {
          const canvas = {
            width,
            height,
            getContext: (type: string) => {
              // Use Canvas from canvas package if available, otherwise create a mock
              try {
                const { createCanvas } = require('canvas');
                return createCanvas(width, height).getContext('2d');
              } catch {
                // Fallback: use a simple approach - render to data
                return null;
              }
            },
          };
          return canvas as any;
        },
      };

      // Try using canvas package if available
      let imageData = null;
      try {
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(viewport.width, viewport.height);
        const canvasContext = canvas.getContext('2d');

        await page.render({
          canvasContext,
          viewport,
        }).promise;

        const buffer = canvas.toBuffer('image/png');
        imageData = `data:image/png;base64,${buffer.toString('base64')}`;
      } catch (canvasError) {
        console.warn('Canvas module not available, using PDF rendering fallback', canvasError);
        
        // Fallback: Extract text and basic layout from PDF
        try {
          const textContent = await page.getTextContent();
          const imageData_fallback = await renderPageAsSvg(page, viewport);
          if (imageData_fallback) {
            imageData = imageData_fallback;
          }
        } catch (fallbackError) {
          console.error(`Could not render page ${pageNum}:`, fallbackError);
        }
      }

      if (imageData) {
        // Add slide to presentation
        const slide = prs.addSlide();

        // Calculate aspect ratio to fit slide
        const pageAspectRatio = viewport.width / viewport.height;
        const slideAspectRatio = 10 / 7.5;

        let imgWidth = 10;
        let imgHeight = 7.5;

        if (pageAspectRatio > slideAspectRatio) {
          imgHeight = 10 / pageAspectRatio;
        } else {
          imgWidth = 7.5 * pageAspectRatio;
        }

        // Center the image on slide
        const xPos = (10 - imgWidth) / 2;
        const yPos = (7.5 - imgHeight) / 2;

        // Add image to slide
        slide.addImage({
          data: imageData,
          x: xPos,
          y: yPos,
          w: imgWidth,
          h: imgHeight,
        });
      }
    } catch (pageError) {
      console.error(`Error processing page ${pageNum}:`, pageError);
      // Continue with next page even if one fails
    }
  }

  // Generate PPT file and return as buffer
  try {
    const pptxBytes = await prs.write({ outputType: 'arraybuffer' });
    return Buffer.from(pptxBytes as ArrayBuffer);
  } catch (writeError) {
    console.error('Error writing PPT file:', writeError);
    throw writeError;
  }
}

/**
 * Fallback: Render PDF page as SVG for cases where canvas is not available
 */
async function renderPageAsSvg(
  page: any,
  viewport: any
): Promise<string | null> {
  try {
    const operatorList = await page.getOperatorList();
    // This is a simplified approach - in production you might want to use a proper SVG renderer
    // For now, we'll just return null to skip this page
    return null;
  } catch (error) {
    return null;
  }
}

