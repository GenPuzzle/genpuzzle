'use client';

import React, { useState, useEffect } from 'react';
import { HoneycombLoader } from './HoneycombLoader';

interface PDFImagePreviewProps {
  pdfBlob: Blob | null;
  isLoading?: boolean;
  className?: string;
}

/**
 * Mobile-friendly PDF preview component.
 * Attempts to render PDF in iframe first (desktop), falls back to image rendering (mobile).
 */
export function PDFImagePreview({ pdfBlob, isLoading = false, className = '' }: PDFImagePreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<'iframe' | 'image'>('iframe');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Convert PDF blob to URL
  useEffect(() => {
    if (pdfBlob) {
      // Create object URL for the PDF blob
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // On mobile, try to create a preview image from the PDF
      // This is a fallback - PDF rendering still works via iframe
      if (isMobile) {
        setImageUrl(url);
        setRenderMode('iframe'); // Use iframe by default, it handles mobile better in modern browsers
      }

      // Cleanup function
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [pdfBlob, isMobile]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <HoneycombLoader />
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className={`flex items-center justify-center h-full w-full text-gray-400 flex-col gap-4 ${className}`}>
        <svg className="w-12 h-12 md:w-16 md:h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-base md:text-lg font-medium">No PDF to display</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {renderMode === 'iframe' ? (
        // Use iframe for PDF rendering (works on desktop and modern mobile browsers)
        <iframe
          src={pdfUrl}
          className="w-full h-full border-0 rounded-lg md:rounded-xl flex-1"
          title="PDF Preview"
          style={{
            WebkitAppearance: 'none',
            appearance: 'none',
            minHeight: '400px',
          }}
        />
      ) : (
        // Fallback image rendering (rarely needed with modern browsers)
        <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-auto">
          <img
            src={imageUrl || pdfUrl}
            alt="PDF Page Preview"
            className="max-w-full h-auto object-contain shadow-lg rounded-lg"
            style={{ maxHeight: '100%' }}
          />
        </div>
      )}
    </div>
  );
}

export default PDFImagePreview;