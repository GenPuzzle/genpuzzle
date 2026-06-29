/** Parse word list from comma-separated (horizontal) or newline-separated (vertical) input. */
export function parseWordListFromBothFormats(value: string): string[] {
  if (!value || value.trim().length === 0) return [];

  if (value.includes(',')) {
    return value
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }

  return value
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}
