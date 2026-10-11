# Shared page layout

Canvas, editable PDF, and editable PPTX draw from `ResolvedElement` lists in this folder.
Page variables (Canvas Workspace overlays) are built by `buildPageVariableElements` in `src/lib/page-variables.ts` and appended by the same list in preview, PDF, and PPTX. **Add text** / **Single image** stay on the current page (`scope: 'single'`). Clicking **Add text** places a box you type into on the canvas (no dialog). **Variable text** / **Image variables** appear on every page in the document, with one line or image per page. This includes puzzle pages and front-matter pages (title, table of contents, introduction, instructions, blank). Canvas Workspace font controls bind to selected native puzzle parts and to title/TOC/introduction/instruction/blank text. Shapes are PowerPoint-native and stay on the page where they were placed; placing a shape does not open a text dialog or show placeholder "Text". To label a shape, choose **Add text** / **Variable text** (or click those options while a shape is selected) and place/attach onto the shape. Header title/subtitle/number shapes are editable from the format bar when those native parts are selected. Maze/sudoku/word-search grids resize from selection handles via `puzzleGridScale`. 3D styles stay live text (`ResolvedText.effect`). Native title, grid, clues, word-list, header number, subtitle, cryptogram answer key, and trivia suggestion fonts are written from the Canvas Workspace format bar into document typography so canvas, PDF, and PPTX stay matching. Coordinates are points, origin at the top-left. Renderers translate primitives. They do not paginate, wrap text, or recompute grid spacing.

## Add a puzzle type

1. Generate the puzzle once in the existing puzzle module. Do not generate it again during export.
2. Add a builder that returns `ResolvedElement[]` from the shared page layout (`computeGenericPageLayout`, `computeWordSearchPageLayout`, or the text/murdoku layout helpers).
3. Draw it with `ResolvedElementsView`, `renderResolvedPdf`, and `renderResolvedPpt`.
4. Do not add a second layout formula in a renderer.
5. Add a fixture to `consistency.selftest.ts` and run `npm run check:layout`.

## Add a drawing primitive

1. Add the kind to `RESOLVED_ELEMENT_KINDS` and to `ResolvedElement` in `types.ts`.
2. Add a handler in `dispatchResolved`. TypeScript then requires a handler in `ResolvedElementsView.tsx`, `render-pdf.ts`, and `render-ppt.ts`.
3. `npm run check:layout` draws one sample of every kind with all three renderers. A missing handler fails that check.

## Add a page kind

1. Add the compiled page kind.
2. Add it to `EXPORT_ROUTES` as `native`.
3. Draw it from the shared element list in the preview, PDF, and PPTX.
4. Do not register a new `snapshot` route. The check fails if one appears. The existing Murdoku snapshot routes stay listed as `NOT PASSED`.

## Text

Line breaks are stored on the element (`lines`). Renderers use that list and the given `fontSize`. They must not turn on autofit or shrink-to-fit.

PDF baselines use `lineTop + (lineHeight - fontSize) / 2 + fontSize * PDF_CAP_HEIGHT_RATIO` (`0.7` in `grid-letter-centering.ts`). The half-leading term matches CSS line boxes, which center the em box in `lineHeight`. The canvas view uses that CSS line box. PPTX still anchors the text body with `valign` and does not read `PDF_CAP_HEIGHT_RATIO`. A word-search fixture measured the old PDF letters 12px above the shared highlight while the browser preview sat on the highlight; the half-leading term is that fix. Do not describe a remaining gap as a font-engine mismatch unless the anchors already match and only the outlines differ. Missing fonts on the machine that opens the file are a separate, machine-specific issue. Do not flatten text to hide either one.

## Checks

`npm run check:layout` is required before a page-content or layout change is complete. Each line is `PASSED`, `NOT RUN`, or `NOT PASSED`. `NOT RUN` means the tool was missing (browser or LibreOffice). `NOT PASSED` means a known gap, including text pages and Murdoku snapshots. Do not describe either as a pass.

The check also draws every registered primitive in all three renderers and rejects a new page kind that exports as a picture.
