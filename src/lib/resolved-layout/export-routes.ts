import type { CompiledPage } from '../book-compiler';

/**
 * How each compiled page kind is exported.
 * `native` means canvas, PDF, and PPTX draw shared layout primitives.
 * `snapshot` is existing debt: the page is still flattened. Do not add a new
 * snapshot route. The layout check reports those kinds as not passed.
 */
export type ExportRoute =
  | { mode: 'native' }
  | { mode: 'snapshot'; knownDebt: true };

export const EXPORT_ROUTES = {
  text: { mode: 'native' },
  blank: { mode: 'native' },
  puzzle: { mode: 'native' },
  solution: { mode: 'native' },
  crossword: { mode: 'native' },
  'crossword-solution': { mode: 'native' },
  'generic-puzzle': { mode: 'native' },
  'generic-puzzle-solution': { mode: 'native' },
  murdoku: { mode: 'snapshot', knownDebt: true },
  'murdoku-solution': { mode: 'snapshot', knownDebt: true },
} as const satisfies Record<CompiledPage['kind'], ExportRoute>;

export function exportRoute(kind: CompiledPage['kind']): ExportRoute {
  return EXPORT_ROUTES[kind];
}

export function assertNativePainter(kind: CompiledPage['kind'], exporter: string): never {
  const route = exportRoute(kind);
  const debt = route.mode === 'snapshot' ? ' It is registered as snapshot debt and must not reach this branch.' : '';
  throw new Error(
    `${exporter} has no painter for page kind "${kind}". Draw it from the shared resolved layout in canvas, PDF, and PPTX in this same change. Do not flatten the page.${debt}`
  );
}
