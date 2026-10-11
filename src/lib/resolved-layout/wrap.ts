/** Canonical wrap. Renderers must draw `lines` and must not wrap again. */
export function wrapLines(text: string, fontSizePt: number, maxWidthPt: number): string[] {
  const source = (text || '').replace(/\s+/g, ' ').trim();
  if (!source) return [];
  const charW = Math.max(1, fontSizePt * 0.5);
  const maxChars = Math.max(1, Math.floor(maxWidthPt / charW));
  const words = source.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
      if (word.length > maxChars) {
        let rest = word.slice(maxChars);
        while (rest.length > maxChars) {
          lines.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        current = rest;
      }
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
