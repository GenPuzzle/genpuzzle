/**
 * Parse a page range expression into sorted 1-based page numbers.
 * Examples: "1,3,4" → [1,3,4]; "1-4" → [1,2,3,4]; "1-4,7-10,12" → [1,2,3,4,7,8,9,10,12]
 */
export function parsePageRangeSelection(input: string, maxPage: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed || maxPage < 1) return null;

  const pages = new Set<number>();
  const parts = trimmed.split(',');

  for (const part of parts) {
    const segment = part.trim();
    if (!segment) return null;

    if (segment.includes('-')) {
      const dashParts = segment.split('-');
      if (dashParts.length !== 2) return null;
      const start = Number.parseInt(dashParts[0].trim(), 10);
      const end = Number.parseInt(dashParts[1].trim(), 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let page = lo; page <= hi; page++) {
        pages.add(page);
      }
    } else {
      const page = Number.parseInt(segment, 10);
      if (!Number.isFinite(page)) return null;
      pages.add(page);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.some((page) => page < 1 || page > maxPage)) return null;

  return sorted;
}

/** Map 1-based document-local page numbers to 0-based batch puzzle indices. */
export function documentPagesToBatchIndices(
  documentPages: number[],
  batchStartIndex: number
): number[] {
  return documentPages.map((page) => batchStartIndex + page - 1);
}
