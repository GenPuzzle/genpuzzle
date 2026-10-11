/**
 * Client-side executor for GenPuzzle agent tool calls.
 * Mutates the live project through existing app APIs / document settings.
 */

import type { DocumentPage, InsertableDocumentKind, PuzzleModuleSettings, TextModuleSettings } from '@/lib/document-model';
import {
  createInsertableDocumentPage,
  isPuzzleModuleSettings,
  isPuzzleModuleType,
} from '@/lib/document-model';
import { applyBookLayoutToDocumentPage } from '@/lib/visual-settings-sync';
import { normalizePuzzleTypeToken } from './puzzle-type-aliases';
import {
  createPageVariableField,
  normalizePageVariables,
  type PageVariableField,
} from '@/lib/page-variables';
import { isTextVariableKey, tokenForVariableKey, type TextVariableKey } from './text-variable-tokens';
import { agentToolRisk, type AgentRiskLevel } from './agent-tools';
import {
  normalizeAiProjectSpec,
  validateAiProjectSpec,
  aiProjectSpecToSetup,
  summarizeAiProjectSpec,
  type AiProjectSpec,
} from './project-spec';
import { buildBookStructurePages, normalizeBookStructureSpec } from './build-book-structure';
import { createStyledChapterDocumentPage } from '@/lib/chapter-page-layouts';
import {
  writeChapterTitlesDraft,
  writeDivideListsPreference,
} from '@/lib/chapter-titles-draft';
import {
  buildPlatformSettingsSnapshot,
  buildPlatformSettingUpdate,
  type PlatformSettingsSource,
} from './platform-settings';
import { normalizeAnswersPerPage } from '@/lib/puzzles/types';
import {
  dispatchAgentPlatformUi,
  listPlatformSettings,
  normalizePlatformCategory,
  PLATFORM_CATEGORY_TAB,
  type PlatformCategory,
} from './platform-settings-registry';
import type { WordSearchSettings, TitleWordsSettings } from '@/lib/puzzles/types';
import {
  contentPackForAiContext,
  formatContentPackSummary,
  summarizeContentPack,
  type ContentPack,
  type ContentPackPuzzleKind,
} from './content-pack';
import { planContentPackApply, type ContentPackApplyMode } from './apply-content-pack';

export interface AgentToolCallPayload {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentSelectedElement {
  id: string;
  type?: string;
  role?: string;
  kind?: string;
  fontSize?: number;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
  variableKey?: string;
  text?: string;
}

export interface AgentProjectContext {
  bookTitle?: string;
  language?: string;
  mixPuzzles?: boolean;
  chapterTopics?: string[];
  documents?: Array<{
    id: string;
    name: string;
    moduleType: string;
    puzzleCount?: number;
    solutionsPerPage?: number;
    includeFunFacts?: boolean;
    titleFontSize?: number;
  }>;
  activeDocumentId?: string;
  puzzleCountEstimate?: number;
}

export interface AgentAppBridge {
  getProjectContext: () => AgentProjectContext;
  getSelectedElements: () => AgentSelectedElement[];
  getActiveDocument: () => DocumentPage | null;
  getDocumentPages: () => DocumentPage[];
  updateDocumentPage: (id: string, patch: Partial<DocumentPage>) => void;
  setBookSettings: (patch: Record<string, unknown>) => void;
  getBookSettings: () => Record<string, unknown>;
  /** Snapshot before medium/high risk ops (maps to undo). */
  pushUndoSnapshot?: () => void;
  undo?: () => void;
  /** Replace the full document tab list (existing GenPuzzle API). */
  replaceDocumentPages?: (pages: DocumentPage[], activeId?: string | null) => void;
  insertDocumentPage?: (
    type: string,
    position: 'before' | 'after',
    referenceId?: string
  ) => void;
  /** Remove a document tab by id (refuses when only one tab remains). */
  removeDocumentPage?: (id: string) => void;
  setProjectName?: (name: string) => void;
  requestCreateFromSpec?: (spec: AiProjectSpec) => Promise<{ ok: boolean; error?: string }>;
  requestGenerateContent?: (args: {
    contentType: string;
    count?: number;
    theme?: string;
    language?: string;
  }) => Promise<{ ok: boolean; values?: string[]; error?: string }>;
  /** Live Word Search / book settings used by the sidebar. */
  getPlatformSettingsSource?: () => PlatformSettingsSource;
  updateWordSearchSettings?: (
    patch: Partial<WordSearchSettings>,
    options?: { recordHistory?: boolean }
  ) => void;
  /** Copy active Word Search puzzle settings onto every word-search document tab. */
  propagateWordSearchSettingsToAllDocuments?: () => void;
  setTitleWords?: (next: TitleWordsSettings) => void;
  setPageMargin?: (value: number) => void;
  setPuzzleGridScale?: (value: number) => void;
  applyTrimSizeLayoutChange?: (
    bookCanvasUpdates: Partial<WordSearchSettings['bookCanvas']>
  ) => void;
  /** Regenerate puzzles; when applyToAllWordSearch, rebuild every WS document. */
  requestRegenerate?: (
    documentId?: string,
    options?: {
      applyToAllWordSearch?: boolean;
      /** Generate each listed document in order (settings synced from page). */
      documentIds?: string[];
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  requestExport?: (format: 'pdf' | 'pptx') => Promise<{ ok: boolean; error?: string }>;
  /** TXT/Excel content pack uploaded in the AI chat panel. */
  getContentPack?: () => ContentPack | null;
  setActiveDocumentPageId?: (id: string) => void;
  setCrosswordSettings?: (settings: import('@/lib/crossword-settings').CrosswordSettings) => void;
  setGenericPuzzleSettings?: (
    settings: import('@/lib/generic-puzzle-settings').GenericPuzzleSettings
  ) => void;
}

export interface AgentToolResult {
  toolCallId: string;
  name: string;
  risk: AgentRiskLevel;
  ok: boolean;
  message: string;
  data?: unknown;
  requiresConfirmation?: boolean;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function patchPageVariables(
  page: DocumentPage,
  mapper: (fields: PageVariableField[]) => PageVariableField[]
): DocumentPage {
  if (!isPuzzleModuleSettings(page.settings) && !(page.settings as { pageVariables?: unknown }).pageVariables) {
    return page;
  }
  const settings = { ...(page.settings as PuzzleModuleSettings & { pageVariables?: PageVariableField[] }) };
  const fields = normalizePageVariables(settings.pageVariables);
  settings.pageVariables = mapper(fields);
  return { ...page, settings };
}

function applyFontFloorToTypography(
  typography: Record<string, unknown>,
  min: number
): Record<string, unknown> {
  const next = { ...typography };
  for (const key of Object.keys(next)) {
    if (/fontSize/i.test(key) && typeof next[key] === 'number') {
      next[key] = Math.max(min, Number(next[key]));
    }
  }
  return next;
}

export async function executeAgentToolCall(
  call: AgentToolCallPayload,
  bridge: AgentAppBridge
): Promise<AgentToolResult> {
  const risk = agentToolRisk(call.name);
  const args = parseArgs(call.arguments);

  try {
    switch (call.name) {
      case 'get_project_context': {
        const ctx = bridge.getProjectContext();
        const includeSelected = args.includeSelected !== false;
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Project context loaded.',
          data: {
            ...ctx,
            selectedElements: includeSelected ? bridge.getSelectedElements() : undefined,
          },
        };
      }
      case 'get_selected_elements': {
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Selected elements loaded.',
          data: bridge.getSelectedElements(),
        };
      }
      case 'get_platform_settings': {
        if (!bridge.getPlatformSettingsSource) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Platform settings are not available in this context.',
          };
        }
        const catsRaw = Array.isArray(args.categories) ? args.categories : [];
        const categories = catsRaw
          .map((c) => normalizePlatformCategory(String(c)))
          .filter((c): c is PlatformCategory => Boolean(c));
        const source = bridge.getPlatformSettingsSource();
        const snapshot = buildPlatformSettingsSnapshot(
          source,
          categories.length ? categories : undefined
        );
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Platform settings loaded.',
          data: {
            settings: snapshot,
            catalog: listPlatformSettings(categories.length ? categories : undefined).map((d) => ({
              category: d.category,
              name: d.name,
              label: d.label,
              type: d.type,
              tab: d.tab,
              min: d.min,
              max: d.max,
              enumValues: d.enumValues,
            })),
          },
        };
      }
      case 'switch_sidebar_tab': {
        const category = normalizePlatformCategory(String(args.category || ''));
        if (!category) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Unknown tab category. Use trim, style, chapters, puzzle, words, or titles.',
          };
        }
        const meta = PLATFORM_CATEGORY_TAB[category];
        dispatchAgentPlatformUi({
          type: 'switch_tab',
          category,
          tab: meta.tab,
          panel: meta.panel,
        });
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `Switched to the ${meta.title} tab.`,
          data: { category, tab: meta.tab, panel: meta.panel },
        };
      }
      case 'update_platform_setting': {
        if (!bridge.getPlatformSettingsSource) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Platform settings are not available in this context.',
          };
        }
        const category = String(args.category || '');
        const settingName = String(args.setting_name || args.settingName || '');
        const built = buildPlatformSettingUpdate(
          bridge.getPlatformSettingsSource(),
          category,
          settingName,
          args.value
        );
        if (!built.ok) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: built.error,
          };
        }
        const { patch } = built;
        bridge.pushUndoSnapshot?.();
        dispatchAgentPlatformUi({
          type: 'switch_tab',
          category: patch.highlight.category,
          tab: patch.tab,
          panel: patch.panel,
        });
        if (patch.trimSizePreset && bridge.applyTrimSizeLayoutChange) {
          bridge.applyTrimSizeLayoutChange({
            trimSizePreset: patch.trimSizePreset as never,
            useCustomTrim: false,
          });
        }
        if (patch.wordSearch && bridge.updateWordSearchSettings) {
          bridge.updateWordSearchSettings(patch.wordSearch, { recordHistory: false });
        }
        if (patch.titleWords && bridge.setTitleWords) {
          bridge.setTitleWords(patch.titleWords);
        }
        if (patch.bookSettings) {
          bridge.setBookSettings(patch.bookSettings as Record<string, unknown>);
        }
        if (typeof patch.pageMargin === 'number' && bridge.setPageMargin) {
          bridge.setPageMargin(patch.pageMargin);
        }
        if (typeof patch.puzzleGridScale === 'number' && bridge.setPuzzleGridScale) {
          bridge.setPuzzleGridScale(patch.puzzleGridScale);
        }
        dispatchAgentPlatformUi({
          type: 'highlight_setting',
          category: patch.highlight.category,
          settingName: patch.highlight.settingName,
          durationMs: 2200,
        });
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `Updated ${patch.highlight.category} → ${patch.label} on the ${PLATFORM_CATEGORY_TAB[patch.highlight.category].title} tab.`,
          data: {
            category: patch.highlight.category,
            setting_name: patch.highlight.settingName,
            value: args.value,
            tab: patch.tab,
          },
        };
      }
      case 'propagate_word_search_settings': {
        if (!bridge.propagateWordSearchSettingsToAllDocuments) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Propagating Word Search settings is not available here.',
          };
        }
        bridge.pushUndoSnapshot?.();
        bridge.propagateWordSearchSettingsToAllDocuments();
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Copied Word Search puzzle settings to all Word Search documents.',
        };
      }
      case 'create_project_from_spec': {
        if (args.confirmed !== true) {
          const spec = normalizeAiProjectSpec(args.spec);
          const error = validateAiProjectSpec(spec);
          if (error) {
            return {
              toolCallId: call.id,
              name: call.name,
              risk,
              ok: false,
              message: error,
            };
          }
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: true,
            requiresConfirmation: true,
            message: 'Confirm to create this project from the planned spec.',
            data: { summary: summarizeAiProjectSpec(spec), setup: aiProjectSpecToSetup(spec) },
          };
        }
        if (!bridge.requestCreateFromSpec) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Project creation is not available in this context.',
          };
        }
        bridge.pushUndoSnapshot?.();
        const spec = normalizeAiProjectSpec(args.spec);
        const result = await bridge.requestCreateFromSpec(spec);
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: result.ok,
          message: result.ok ? 'Project created from specification.' : result.error || 'Create failed.',
        };
      }
      case 'update_project_settings': {
        const changes = (args.changes && typeof args.changes === 'object'
          ? args.changes
          : {}) as Record<string, unknown>;
        bridge.pushUndoSnapshot?.();
        const book = { ...bridge.getBookSettings() };
        if (typeof changes.mixPuzzles === 'boolean') book.mixPuzzles = changes.mixPuzzles;
        if (Array.isArray(changes.chapterTopics)) {
          book.chapterTopics = changes.chapterTopics.map((t) => String(t));
          book.mixPuzzles = true;
        }
        bridge.setBookSettings(book);

        if (typeof changes.minimumFontSize === 'number' || typeof changes.startPuzzleNumber === 'number') {
          const min =
            typeof changes.minimumFontSize === 'number'
              ? Math.max(8, Math.min(48, Math.round(changes.minimumFontSize)))
              : null;
          const start =
            typeof changes.startPuzzleNumber === 'number'
              ? Math.max(1, Math.round(changes.startPuzzleNumber))
              : null;
          for (const page of bridge.getDocumentPages()) {
            if (!isPuzzleModuleSettings(page.settings)) continue;
            const settings = { ...page.settings } as PuzzleModuleSettings;
            if (settings.wordSearchSettings) {
              const ws = { ...settings.wordSearchSettings };
              if (start != null) ws.core = { ...ws.core, puzzlesStartingNumber: start };
              if (min != null) {
                ws.typography = applyFontFloorToTypography(
                  { ...ws.typography } as Record<string, unknown>,
                  min
                ) as unknown as typeof ws.typography;
              }
              settings.wordSearchSettings = ws;
            }
            if (settings.genericPuzzleSettings) {
              const gp = { ...settings.genericPuzzleSettings };
              if (start != null) gp.core = { ...gp.core, puzzlesStartingNumber: start };
              if (min != null) {
                gp.typography = applyFontFloorToTypography(
                  { ...gp.typography } as Record<string, unknown>,
                  min
                ) as unknown as typeof gp.typography;
              }
              settings.genericPuzzleSettings = gp;
            }
            if (settings.crosswordSettings) {
              const cw = { ...settings.crosswordSettings };
              if (start != null) cw.core = { ...cw.core, puzzlesStartingNumber: start };
              settings.crosswordSettings = cw;
            }
            if (min != null && settings.pageVariables) {
              settings.pageVariables = normalizePageVariables(settings.pageVariables).map((f) => ({
                ...f,
                fontSize: Math.max(min, f.fontSize ?? min),
              }));
            }
            bridge.updateDocumentPage(page.id, { settings });
          }
        }

        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Project settings updated.',
        };
      }
      case 'update_puzzle_settings': {
        const changes = (args.changes && typeof args.changes === 'object'
          ? args.changes
          : {}) as Record<string, unknown>;
        const docId =
          (typeof args.documentId === 'string' && args.documentId) ||
          bridge.getActiveDocument()?.id;
        const page = bridge.getDocumentPages().find((p) => p.id === docId);
        if (!page || !isPuzzleModuleSettings(page.settings)) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'No puzzle document to update.',
          };
        }
        bridge.pushUndoSnapshot?.();
        const settings = { ...page.settings } as PuzzleModuleSettings;
        const min =
          typeof changes.minimumFontSize === 'number'
            ? Math.max(8, Math.min(48, Math.round(changes.minimumFontSize)))
            : null;
        const titleSize =
          typeof changes.titleFontSize === 'number'
            ? Math.max(8, Math.min(72, Math.round(changes.titleFontSize)))
            : null;

        if (settings.wordSearchSettings) {
          const ws = { ...settings.wordSearchSettings };
          if (typeof changes.includeFunFacts === 'boolean') {
            ws.typography = { ...ws.typography, includeFunFacts: changes.includeFunFacts };
          }
          if (typeof changes.puzzlesStartingNumber === 'number') {
            ws.core = {
              ...ws.core,
              puzzlesStartingNumber: Math.max(1, Math.round(changes.puzzlesStartingNumber)),
            };
          }
          if (titleSize != null) {
            ws.typography = { ...ws.typography, puzzleTitleFontSize: titleSize };
          }
          if (min != null) {
            ws.typography = applyFontFloorToTypography(
              { ...ws.typography } as Record<string, unknown>,
              min
            ) as unknown as typeof ws.typography;
          }
          settings.wordSearchSettings = ws;
        }
        if (settings.genericPuzzleSettings) {
          const gp = { ...settings.genericPuzzleSettings };
          if (typeof changes.includeFunFacts === 'boolean') {
            gp.typography = { ...gp.typography, includeFunFacts: changes.includeFunFacts };
          }
          if (typeof changes.puzzlesStartingNumber === 'number') {
            gp.core = {
              ...gp.core,
              puzzlesStartingNumber: Math.max(1, Math.round(changes.puzzlesStartingNumber)),
            };
          }
          if (typeof changes.numberOfPuzzles === 'number') {
            gp.core = {
              ...gp.core,
              numberOfPuzzles: Math.max(1, Math.round(changes.numberOfPuzzles)),
            };
          }
          if (titleSize != null) {
            gp.typography = { ...gp.typography, puzzleTitleFontSize: titleSize };
          }
          if (min != null) {
            gp.typography = applyFontFloorToTypography(
              { ...gp.typography } as Record<string, unknown>,
              min
            ) as unknown as typeof gp.typography;
          }
          settings.genericPuzzleSettings = gp;
        }
        bridge.updateDocumentPage(page.id, { settings });
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Puzzle settings updated.',
        };
      }
      case 'update_element': {
        const id = String(args.id || '');
        const changes = (args.changes && typeof args.changes === 'object'
          ? args.changes
          : {}) as Record<string, unknown>;
        if (!id) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Element id is required.',
          };
        }
        const page = bridge.getActiveDocument();
        if (!page) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'No active document.',
          };
        }
        bridge.pushUndoSnapshot?.();
        const next = patchPageVariables(page, (fields) =>
          fields.map((field) => {
            if (field.id !== id) return field;
            const patched: PageVariableField = { ...field };
            if (typeof changes.fontSize === 'number') {
              patched.fontSize = Math.max(8, Math.min(96, Math.round(changes.fontSize)));
            }
            if (typeof changes.fontFamily === 'string') patched.fontFamily = changes.fontFamily;
            if (typeof changes.bold === 'boolean') patched.bold = changes.bold;
            if (typeof changes.italic === 'boolean') patched.italic = changes.italic;
            if (typeof changes.color === 'string') patched.color = changes.color;
            if (changes.align === 'left' || changes.align === 'center' || changes.align === 'right') {
              patched.align = changes.align;
            }
            if (typeof changes.xPercent === 'number') patched.xPercent = changes.xPercent;
            if (typeof changes.yPercent === 'number') patched.yPercent = changes.yPercent;
            if (typeof changes.widthPercent === 'number') patched.widthPercent = changes.widthPercent;
            if (typeof changes.heightPercent === 'number') {
              patched.heightPercent = changes.heightPercent;
            }
            if (typeof changes.startNumber === 'number') {
              patched.startNumber = Math.max(1, Math.round(changes.startNumber));
            }
            if (typeof changes.text === 'string') {
              patched.textLines = [changes.text.normalize('NFC')];
            }
            if (changes.variableKey === 'none') patched.variableKey = 'none';
            else if (isTextVariableKey(changes.variableKey)) {
              patched.variableKey = changes.variableKey as TextVariableKey;
            }
            return patched;
          })
        );
        bridge.updateDocumentPage(page.id, { settings: next.settings });
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: 'Element updated.',
        };
      }
      case 'batch_update_elements': {
        const selector = (args.selector && typeof args.selector === 'object'
          ? args.selector
          : {}) as Record<string, unknown>;
        const changes = (args.changes && typeof args.changes === 'object'
          ? args.changes
          : {}) as Record<string, unknown>;
        bridge.pushUndoSnapshot?.();
        let updated = 0;
        const selectedIds = new Set(bridge.getSelectedElements().map((el) => el.id));
        const pages =
          selector.scope === 'selected' || selector.scope === 'active_document'
            ? [bridge.getActiveDocument()].filter(Boolean) as DocumentPage[]
            : bridge.getDocumentPages();

        for (const page of pages) {
          const next = patchPageVariables(page, (fields) =>
            fields.map((field) => {
              const matchKind =
                !selector.kind || selector.kind === field.kind || selector.elementType === field.kind;
              const matchVar =
                !selector.variableKey ||
                selector.variableKey === field.variableKey ||
                selector.elementType === field.variableKey;
              const matchSelected =
                selector.scope !== 'selected' || selectedIds.has(field.id);
              if (!matchKind || !matchVar || !matchSelected) return field;
              updated += 1;
              const patched: PageVariableField = { ...field };
              if (typeof changes.fontSize === 'number') {
                patched.fontSize = Math.max(8, Math.min(96, Math.round(changes.fontSize)));
              }
              if (typeof changes.minimumFontSize === 'number') {
                const min = Math.max(8, Math.round(changes.minimumFontSize));
                patched.fontSize = Math.max(min, patched.fontSize ?? min);
              }
              if (typeof changes.fontFamily === 'string') patched.fontFamily = changes.fontFamily;
              if (typeof changes.bold === 'boolean') patched.bold = changes.bold;
              if (typeof changes.italic === 'boolean') patched.italic = changes.italic;
              if (typeof changes.color === 'string') patched.color = changes.color;
              if (changes.align === 'left' || changes.align === 'center' || changes.align === 'right') {
                patched.align = changes.align;
              }
              if (typeof changes.yPercent === 'number') patched.yPercent = changes.yPercent;
              if (typeof changes.startNumber === 'number') {
                patched.startNumber = Math.max(1, Math.round(changes.startNumber));
              }
              if (changes.variableKey === 'none') patched.variableKey = 'none';
              else if (isTextVariableKey(changes.variableKey)) {
                patched.variableKey = changes.variableKey as TextVariableKey;
              }
              return patched;
            })
          );
          bridge.updateDocumentPage(page.id, { settings: next.settings });
        }

        // Also bump title fonts when selector targets puzzle_title without page vars
        if (
          selector.elementType === 'puzzle_title' &&
          (typeof changes.fontSize === 'number' || typeof changes.minimumFontSize === 'number')
        ) {
          const size =
            typeof changes.fontSize === 'number'
              ? Math.round(changes.fontSize)
              : Math.round(Number(changes.minimumFontSize));
          for (const page of bridge.getDocumentPages()) {
            if (!isPuzzleModuleSettings(page.settings)) continue;
            const settings = { ...page.settings } as PuzzleModuleSettings;
            if (settings.wordSearchSettings) {
              settings.wordSearchSettings = {
                ...settings.wordSearchSettings,
                typography: {
                  ...settings.wordSearchSettings.typography,
                  puzzleTitleFontSize: size,
                },
              };
              updated += 1;
            }
            if (settings.genericPuzzleSettings) {
              settings.genericPuzzleSettings = {
                ...settings.genericPuzzleSettings,
                typography: {
                  ...settings.genericPuzzleSettings.typography,
                  puzzleTitleFontSize: size,
                },
              };
              updated += 1;
            }
            bridge.updateDocumentPage(page.id, { settings });
          }
        }

        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `${updated} element(s) updated.`,
          data: { updated },
        };
      }
      case 'update_solution_settings': {
        const perPage = Math.max(1, Math.min(9, Math.round(Number(args.solutionsPerPage) || 4)));
        bridge.pushUndoSnapshot?.();
        const applyAll = args.applyToAllDocuments !== false;
        const pages = applyAll
          ? bridge.getDocumentPages()
          : [bridge.getDocumentPages().find((p) => p.id === args.documentId) || bridge.getActiveDocument()].filter(
              Boolean
            ) as DocumentPage[];
        for (const page of pages) {
          if (!isPuzzleModuleSettings(page.settings)) continue;
          const settings = { ...page.settings } as PuzzleModuleSettings;
          if (settings.genericPuzzleSettings) {
            settings.genericPuzzleSettings = {
              ...settings.genericPuzzleSettings,
              core: { ...settings.genericPuzzleSettings.core, solutionsPerPage: perPage },
            };
          }
          if (settings.wordSearchSettings) {
            settings.wordSearchSettings = {
              ...settings.wordSearchSettings,
              bookCanvas: {
                ...settings.wordSearchSettings.bookCanvas,
                answersPerPage: normalizeAnswersPerPage(perPage),
              },
            };
          }
          if (settings.crosswordSettings) {
            settings.crosswordSettings = {
              ...settings.crosswordSettings,
              bookCanvas: {
                ...settings.crosswordSettings.bookCanvas,
                answersPerPage: normalizeAnswersPerPage(perPage),
              },
            };
          }
          bridge.updateDocumentPage(page.id, { settings });
        }
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `Solutions set to ${perPage} per page.`,
        };
      }
      case 'manage_chapters': {
        bridge.pushUndoSnapshot?.();
        const book = { ...bridge.getBookSettings() };
        const action = String(args.action || '');
        if (action === 'enable_mixed') book.mixPuzzles = true;
        if (action === 'disable_mixed') book.mixPuzzles = false;
        if (action === 'set_titles' && Array.isArray(args.titles)) {
          book.chapterTopics = args.titles.map((t) => String(t).normalize('NFC'));
          book.mixPuzzles = true;
        }
        if (action === 'set_count') {
          const count = Math.max(1, Math.min(40, Math.round(Number(args.count) || 1)));
          const existing = Array.isArray(book.chapterTopics)
            ? (book.chapterTopics as string[])
            : [];
          const titles = Array.from({ length: count }, (_, i) => existing[i] || `Chapter ${i + 1}`);
          book.chapterTopics = titles;
          book.mixPuzzles = true;
        }
        const titles = Array.isArray(book.chapterTopics)
          ? (book.chapterTopics as string[])
          : [];
        bridge.setBookSettings(book);
        writeChapterTitlesDraft({ titles, touched: true });
        writeDivideListsPreference({
          enabled: true,
          chapterCount: Math.max(2, titles.length || 2),
        });

        // Keep Chapters panel + document tabs in sync: ensure chapter title pages exist.
        if ((action === 'set_count' || action === 'set_titles') && titles.length > 0) {
          const existing = bridge.getDocumentPages();
          const nonChapter = existing.filter((page) => {
            const settings = page.settings as TextModuleSettings;
            return !(settings?.isChapterPage || page.name.startsWith('Chapter'));
          });
          const chapterPages = titles.map((title, index) => {
            const page = createStyledChapterDocumentPage(title, {
              subtitleEnabled: true,
              subtitleText: `Chapter ${index + 1}`,
            });
            const settings = page.settings as TextModuleSettings;
            settings.isChapterPage = true;
            settings.chapterIndex = index;
            return page;
          });
          if (bridge.replaceDocumentPages) {
            // Keep front-matter / puzzle docs; refresh chapter dividers at end if none mixed in.
            const hasChapterPages = existing.some(
              (page) => (page.settings as TextModuleSettings)?.isChapterPage
            );
            if (!hasChapterPages) {
              bridge.replaceDocumentPages([...nonChapter, ...chapterPages], nonChapter[0]?.id);
            } else {
              // Rebuild: preserve non-chapter docs, append refreshed chapters
              bridge.replaceDocumentPages([...nonChapter, ...chapterPages], nonChapter[0]?.id);
            }
          }
        }

        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `Chapters updated (${titles.length || 0}).`,
          data: { chapterTopics: book.chapterTopics, mixPuzzles: book.mixPuzzles },
        };
      }
      case 'insert_document_tabs': {
        if (!bridge.replaceDocumentPages && !bridge.insertDocumentPage) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Adding tabs isn’t available right now.',
          };
        }
        const rawTypes = Array.isArray(args.types) ? args.types : [];
        const types = rawTypes
          .map((t) => normalizePuzzleTypeToken(String(t || '')) || String(t || '').trim().toLowerCase())
          .filter(Boolean) as string[];
        if (types.length === 0) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Tell me which tabs to add (e.g. word-search, crossword).',
          };
        }

        const position = args.position === 'before' ? 'before' : 'after';
        const existing = bridge.getDocumentPages();
        const active = bridge.getActiveDocument();
        const refIndex = active
          ? existing.findIndex((p) => p.id === active.id)
          : existing.length - 1;
        const insertAt =
          position === 'before'
            ? Math.max(0, refIndex)
            : Math.max(0, refIndex + 1);

        const layoutSource = bridge.getPlatformSettingsSource?.()?.wordSearchSettings;
        const created: DocumentPage[] = [];
        for (const type of types) {
          let page = createInsertableDocumentPage(type as InsertableDocumentKind);
          if (layoutSource && isPuzzleModuleType(page.moduleType)) {
            page = applyBookLayoutToDocumentPage(page, layoutSource);
          }
          created.push(page);
        }

        bridge.pushUndoSnapshot?.();
        if (bridge.replaceDocumentPages) {
          const next = [...existing];
          next.splice(insertAt, 0, ...created);
          bridge.replaceDocumentPages(next, created[created.length - 1]?.id ?? null);
        } else {
          // Fallback: sequential inserts (order may be less reliable).
          for (const type of types) {
            bridge.insertDocumentPage?.(type, position);
          }
        }

        const pretty = created.map((p) => p.name || p.moduleType).join(', ');
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `✨ Added tab${created.length === 1 ? '' : 's'}: **${pretty}**`,
          data: {
            types: created.map((p) => p.moduleType),
            ids: created.map((p) => p.id),
            position,
          },
        };
      }
      case 'build_book_structure': {
        if (args.confirmed !== true) {
          const spec = normalizeBookStructureSpec(args.spec);
          const preview = buildBookStructurePages(spec);
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: true,
            requiresConfirmation: true,
            message: `Confirm to build: ${preview.summary}`,
            data: { summary: preview.summary, chapterTitles: preview.chapterTitles },
          };
        }
        if (!bridge.replaceDocumentPages) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Document tab replacement is not available in this context.',
          };
        }
        const spec = normalizeBookStructureSpec(args.spec);
        if (spec.chapterCount < 1) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'chapterCount must be at least 1.',
          };
        }
        bridge.pushUndoSnapshot?.();
        const built = buildBookStructurePages(spec);
        const nextPages =
          spec.replaceExisting === false
            ? [...bridge.getDocumentPages(), ...built.pages]
            : built.pages;
        bridge.replaceDocumentPages(nextPages, nextPages[0]?.id);
        bridge.setBookSettings({
          ...bridge.getBookSettings(),
          mixPuzzles: true,
          chapterTopics: built.chapterTitles,
        });
        if (spec.bookTitle) bridge.setProjectName?.(spec.bookTitle);
        writeChapterTitlesDraft({ titles: built.chapterTitles, touched: true });
        writeDivideListsPreference({
          enabled: true,
          chapterCount: Math.max(2, built.chapterTitles.length),
        });
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `Book structure applied: ${built.summary}`,
          data: {
            pageCount: nextPages.length,
            chapterTitles: built.chapterTitles,
            documentNames: nextPages.map((p) => p.name),
          },
        };
      }
      case 'generate_content': {
        if (!bridge.requestGenerateContent) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Content generation is not wired in this panel yet.',
          };
        }
        bridge.pushUndoSnapshot?.();
        const result = await bridge.requestGenerateContent({
          contentType: String(args.contentType || 'fun_facts'),
          count: typeof args.count === 'number' ? args.count : undefined,
          theme: typeof args.theme === 'string' ? args.theme : undefined,
          language: typeof args.language === 'string' ? args.language : undefined,
        });
        if (result.ok && result.values && result.values.length > 0) {
          const page = bridge.getActiveDocument();
          if (page && isPuzzleModuleSettings(page.settings)) {
            const settings = { ...page.settings } as PuzzleModuleSettings;
            const contentType = String(args.contentType || '');
            if (contentType === 'fun_facts') {
              if (settings.wordSearchSettings) {
                settings.wordSearchSettings = {
                  ...settings.wordSearchSettings,
                  typography: {
                    ...settings.wordSearchSettings.typography,
                    includeFunFacts: false,
                    funFactsText: result.values.join('\n'),
                  },
                };
              }
              if (settings.genericPuzzleSettings) {
                settings.genericPuzzleSettings = {
                  ...settings.genericPuzzleSettings,
                  typography: {
                    ...settings.genericPuzzleSettings.typography,
                    includeFunFacts: false,
                    funFactsText: result.values.join('\n'),
                  },
                };
              }
              const fields = normalizePageVariables(settings.pageVariables);
              if (!fields.some((f) => f.variableKey === 'fun_fact')) {
                const field = createPageVariableField('text', 50, 14, {
                  variableKey: 'fun_fact',
                  textLines: [tokenForVariableKey('fun_fact')],
                  fontSize: 14,
                  bold: false,
                  widthPercent: 72,
                  heightPercent: 8,
                  scope: 'document',
                });
                field.yPercent = 11;
                field.xPercent = 14;
                fields.push(field);
              } else {
                for (const field of fields) {
                  if (field.variableKey === 'fun_fact') {
                    field.textLines = [tokenForVariableKey('fun_fact')];
                  }
                }
              }
              settings.pageVariables = fields;
            }
            bridge.updateDocumentPage(page.id, { settings });
          }
        }
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: result.ok,
          message: result.ok
            ? `Generated ${result.values?.length ?? 0} value(s).`
            : result.error || 'Generation failed.',
          data: result.values,
        };
      }
      case 'regenerate_puzzles': {
        if (args.confirmed !== true) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: true,
            requiresConfirmation: true,
            message: 'Confirm to regenerate puzzles with GenPuzzle generators.',
          };
        }
        if (!bridge.requestRegenerate) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Regenerate is not available here.',
          };
        }
        bridge.pushUndoSnapshot?.();
        const result = await bridge.requestRegenerate(
          typeof args.documentId === 'string' ? args.documentId : undefined,
          { applyToAllWordSearch: args.applyToAllWordSearch === true }
        );
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: result.ok,
          message: result.ok ? 'Puzzles regenerated.' : result.error || 'Regenerate failed.',
        };
      }
      case 'export_project': {
        if (args.confirmed !== true) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: true,
            requiresConfirmation: true,
            message: `Confirm to export as ${args.format}.`,
          };
        }
        if (!bridge.requestExport) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Export is not available from the assistant.',
          };
        }
        const result = await bridge.requestExport(args.format === 'pptx' ? 'pptx' : 'pdf');
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: result.ok,
          message: result.ok ? 'Export started.' : result.error || 'Export failed.',
        };
      }
      case 'remove_document_page': {
        const pages = bridge.getDocumentPages();
        if (pages.length <= 1) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: '🗑️ Can’t remove the last tab.',
          };
        }
        if (!bridge.removeDocumentPage) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Tab remove isn’t available right now.',
          };
        }

        let target =
          typeof args.documentId === 'string'
            ? pages.find((p) => p.id === args.documentId) ?? null
            : null;

        if (!target && typeof args.tabIndex === 'number') {
          const idx = Math.round(Number(args.tabIndex));
          if (idx >= 1 && idx <= pages.length) {
            target = pages[idx - 1] ?? null;
          } else {
            return {
              toolCallId: call.id,
              name: call.name,
              risk,
              ok: false,
              message: `No tab **${idx}** (open tabs: 1–${pages.length}).`,
            };
          }
        }

        if (!target && typeof args.moduleType === 'string') {
          const moduleType = String(args.moduleType).trim();
          const matches = pages
            .map((page, index) => ({ page, tabIndex: index + 1 }))
            .filter(({ page }) => page.moduleType === moduleType);
          if (matches.length === 0) {
            return {
              toolCallId: call.id,
              name: call.name,
              risk,
              ok: false,
              message: `No **${moduleType}** tab open.`,
            };
          }
          if (matches.length > 1) {
            const list = matches
              .map(({ page, tabIndex }) => `• **${tabIndex}** — ${page.name || moduleType}`)
              .join('\n');
            return {
              toolCallId: call.id,
              name: call.name,
              risk,
              ok: false,
              message: `Several **${moduleType}** tabs:\n${list}\n\nWhich tab number should I remove?`,
              data: {
                needsTabIndex: true,
                candidates: matches.map(({ page, tabIndex }) => ({
                  tabIndex,
                  id: page.id,
                  name: page.name,
                  moduleType: page.moduleType,
                })),
              },
            };
          }
          target = matches[0].page;
        }

        if (!target) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Tell me a tab number (e.g. remove tab 3) or a document type.',
          };
        }

        const tabIndex = pages.findIndex((p) => p.id === target!.id) + 1;
        const label = target.name || target.moduleType;
        bridge.pushUndoSnapshot?.();
        bridge.removeDocumentPage(target.id);
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: `🗑️ Removed tab **${tabIndex}** — ${label}`,
          data: { id: target.id, tabIndex, name: target.name, moduleType: target.moduleType },
        };
      }
      case 'get_uploaded_content_pack': {
        const pack = bridge.getContentPack?.() ?? null;
        if (!pack) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message:
              'No content pack here — use **New Project → AI** to upload files.',
          };
        }
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: formatContentPackSummary(pack).split('\n\nHow should')[0] || pack.sourceName,
          data: {
            summary: summarizeContentPack(pack),
            context: contentPackForAiContext(pack),
          },
        };
      }
      case 'apply_content_pack': {
        const pack = bridge.getContentPack?.() ?? null;
        if (!pack) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'No uploaded content pack to apply.',
          };
        }
        const mode = String(args.mode || '') as ContentPackApplyMode;
        if (mode !== 'active' && mode !== 'matching' && mode !== 'rebuild') {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'mode must be active, matching, or rebuild.',
          };
        }
        const types = Array.isArray(args.types)
          ? (args.types.filter((t) => typeof t === 'string') as ContentPackPuzzleKind[])
          : undefined;
        const planned = planContentPackApply({
          pack,
          mode,
          pages: bridge.getDocumentPages(),
          activeDocumentId: bridge.getActiveDocument()?.id ?? null,
          kinds: types,
          bookTitle: bridge.getProjectContext().bookTitle,
        });
        if (!planned.ok || !planned.pages) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: planned.message,
          };
        }
        if (!bridge.replaceDocumentPages) {
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: false,
            message: 'Cannot replace document tabs in this context.',
          };
        }
        bridge.pushUndoSnapshot?.();
        bridge.replaceDocumentPages(planned.pages, planned.activeDocumentId);
        if (planned.chapterTitles?.length) {
          bridge.setBookSettings({
            ...bridge.getBookSettings(),
            mixPuzzles: true,
            chapterTopics: planned.chapterTitles,
          });
          writeChapterTitlesDraft({ titles: planned.chapterTitles, touched: true });
          writeDivideListsPreference({
            enabled: true,
            chapterCount: Math.max(2, planned.chapterTitles.length),
          });
        }
        if (planned.titleWords && bridge.setTitleWords) {
          bridge.setTitleWords(planned.titleWords);
        }
        // Sync active document settings from the applied pack into live sidebar state
        // so generatePuzzle reads the uploaded words/clues/phrases immediately.
        const syncPageSettings = (page: DocumentPage | undefined) => {
          if (!page || !isPuzzleModuleSettings(page.settings)) return;
          const settings = page.settings;
          if (settings.titleWords && bridge.setTitleWords) {
            bridge.setTitleWords(settings.titleWords);
          }
          if (settings.wordSearchSettings && bridge.updateWordSearchSettings) {
            bridge.updateWordSearchSettings(settings.wordSearchSettings, {
              recordHistory: false,
            });
          }
          if (settings.crosswordSettings && bridge.setCrosswordSettings) {
            bridge.setCrosswordSettings(settings.crosswordSettings);
          }
          if (settings.genericPuzzleSettings && bridge.setGenericPuzzleSettings) {
            bridge.setGenericPuzzleSettings(settings.genericPuzzleSettings);
          }
        };
        const activeAfter =
          planned.pages.find((p) => p.id === planned.activeDocumentId) ??
          planned.pages.find((p) => p.moduleType === 'word-search');
        syncPageSettings(activeAfter);

        const shouldRegen = args.regenerate !== false && planned.regenerate;
        if (shouldRegen && bridge.requestRegenerate) {
          const regen = await bridge.requestRegenerate(planned.activeDocumentId || undefined, {
            applyToAllWordSearch: planned.applyToAllMatching === true,
            documentIds: planned.updatedDocumentIds,
          });
          return {
            toolCallId: call.id,
            name: call.name,
            risk,
            ok: regen.ok,
            message: regen.ok
              ? `${planned.message} Word lists applied and puzzles generated.`
              : `${planned.message} Regenerate failed: ${regen.error || 'unknown error'}`,
            data: { updatedDocumentIds: planned.updatedDocumentIds },
          };
        }
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: true,
          message: planned.message,
          data: { updatedDocumentIds: planned.updatedDocumentIds },
        };
      }
      default:
        return {
          toolCallId: call.id,
          name: call.name,
          risk,
          ok: false,
          message: `Unknown tool: ${call.name}`,
        };
    }
  } catch (error) {
    return {
      toolCallId: call.id,
      name: call.name,
      risk,
      ok: false,
      message: error instanceof Error ? error.message : 'Tool execution failed.',
    };
  }
}
