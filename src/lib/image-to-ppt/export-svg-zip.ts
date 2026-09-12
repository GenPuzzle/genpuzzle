import JSZip from 'jszip';
import type { DocumentPage, TextModuleSettings, TextPageBlock } from '@/lib/document-model';
import type { ImageToPptDetection, SvgAssetManifestEntry } from './types';
import { hashString, padPageIndex } from './geometry';

function decodeSvgDataUrl(src: string): string | null {
  if (!src.startsWith('data:image/svg+xml')) return null;
  const comma = src.indexOf(',');
  if (comma < 0) return null;
  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  if (meta.includes(';base64')) {
    try {
      return decodeURIComponent(escape(atob(payload)));
    } catch {
      try {
        return atob(payload);
      } catch {
        return null;
      }
    }
  }
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function svgBlocksForPage(page: DocumentPage): Array<{ block: TextPageBlock; svg: string }> {
  const settings = page.settings as TextModuleSettings;
  const blocks = settings.blocks ?? [];
  const out: Array<{ block: TextPageBlock; svg: string }> = [];
  for (const block of blocks) {
    if (block.kind !== 'image' || !block.imageSrc) continue;
    const svg = decodeSvgDataUrl(block.imageSrc);
    if (svg) out.push({ block, svg });
  }
  return out;
}

export async function downloadSvgAssetsZip(
  pages: DocumentPage[],
  detectionsByPageId: Record<string, ImageToPptDetection[]>,
  zipName = 'project-svg-assets.zip'
): Promise<void> {
  const zip = new JSZip();
  const manifest: SvgAssetManifestEntry[] = [];
  const hashToPath = new Map<string, string>();
  let graphicSerial = 0;

  pages.forEach((page, pageIndex) => {
    const folderName = `Page-${padPageIndex(pageIndex + 1)}`;
    const detections = detectionsByPageId[page.id] ?? [];
    const fromBlocks = svgBlocksForPage(page);
    const items =
      fromBlocks.length > 0
        ? fromBlocks.map(({ block, svg }, index) => ({
            svg,
            x: block.xPercent,
            y: block.yPercent,
            width: block.widthPercent,
            height: block.heightPercent ?? 0,
            blockId: block.id,
            index,
          }))
        : detections
            .filter((item) => item.svgMarkup)
            .map((item, index) => ({
              svg: item.svgMarkup as string,
              x: item.bbox.x,
              y: item.bbox.y,
              width: item.bbox.width,
              height: item.bbox.height,
              blockId: item.id,
              index,
            }));
    items.forEach((item) => {
      const hash = hashString(item.svg);
      let filename = hashToPath.get(hash);
      if (!filename) {
        graphicSerial += 1;
        const localName = `graphic-${padPageIndex(item.index + 1)}.svg`;
        filename = `${folderName}/${localName}`;
        zip.file(filename, item.svg);
        hashToPath.set(hash, filename);
      }
      const region =
        detections.find((entry) => entry.svgMarkup && hashString(entry.svgMarkup) === hash) ??
        detections.filter((entry) => entry.kind === 'graphic')[item.index];
      manifest.push({
        sourcePage: pageIndex + 1,
        pageId: page.id,
        filename,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        originalDetectedRegionId: region?.id ?? item.blockId,
        hash,
      });
    });
  });

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tool: 'GenPuzzle Image to Editable PPT',
        assets: manifest,
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
