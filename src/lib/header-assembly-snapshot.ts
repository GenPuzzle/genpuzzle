/**
 * Captures modular header assembly for PDF/PPT export.
 * Primary: Canvas2D vector paths. Fallback: invisible on-screen DOM + html2canvas.
 */

import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import { renderHeaderAssemblyToDataUrl } from './header-assembly-canvas-draw';

export interface HeaderAssemblySnapshotResult {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function captureDomSnapshot(
  block: UnifiedHeaderAssemblyBlock,
  scale: number
): Promise<HeaderAssemblySnapshotResult | null> {
  if (typeof document === 'undefined') return null;

  const PT_TO_PX = 96 / 72;
  const ptToPx = (pt: number) => pt * PT_TO_PX;
  const widthPx = Math.ceil(ptToPx(block.widthPt));

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-9999;overflow:visible;';
  container.style.width = `${widthPx}px`;
  document.body.appendChild(container);

  let root: { render: (el: unknown) => void; unmount: () => void } | null = null;

  try {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { default: html2canvas } = await import('html2canvas');
    const { HeaderAssemblyBar } = await import('@/components/header/HeaderAssemblyBar');

    root = createRoot(container);
    root.render(
      React.createElement(HeaderAssemblyBar, {
        parts: block.parts,
        settings: block.settings,
        headerWidthPt: block.widthPt,
        titleFontSizePt: block.titleFontSizePt,
        subtitleFontSizePt: block.subtitleFontSizePt,
        subtitleLines: block.subtitleLines,
        titleColor: block.titleColor,
        subtitleColor: block.subtitleColor,
        fontFamily: block.fontFamily,
        subtitleFontFamily: block.subtitleFontFamily,
        subtitleTextWidthPt: block.subtitleTextWidthPt,
        ptToPx,
      })
    );

    await waitForPaint();
    await new Promise((r) => setTimeout(r, 60));

    const el = (container.firstElementChild as HTMLElement) ?? container;
    const heightPx = Math.max(el.scrollHeight, 40);
    const canvas = await html2canvas(el, {
      scale,
      backgroundColor: '#ffffff',
      width: widthPx,
      height: heightPx,
      logging: false,
    });

    return {
      dataUrl: canvas.toDataURL('image/png'),
      widthPt: block.widthPt,
      heightPt: Math.max(block.heightPt, heightPx / PT_TO_PX),
    };
  } catch (e) {
    console.warn('[captureHeaderAssemblySnapshot] DOM fallback failed', e);
    return null;
  } finally {
    root?.unmount();
    container.remove();
  }
}

export async function captureHeaderAssemblySnapshot(
  block: UnifiedHeaderAssemblyBlock,
  options: { scale?: number } = {}
): Promise<HeaderAssemblySnapshotResult | null> {
  const scale = options.scale ?? 3;
  try {
    const canvasSnap = await renderHeaderAssemblyToDataUrl(block, scale);
    if (canvasSnap) return canvasSnap;
    return captureDomSnapshot(block, scale);
  } catch (e) {
    console.warn('[captureHeaderAssemblySnapshot]', e);
    return captureDomSnapshot(block, scale);
  }
}

export function decodeHeaderSnapshotDataUrl(dataUrl: string): Uint8Array | null {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const base64Data = parts[1].replace(/\s/g, '');
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64Data, 'base64'));
    }
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
