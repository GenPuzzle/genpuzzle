/**
 * Local (offline-capable) interpreter for common GenPuzzle AI chat commands.
 * Ensures structural requests still mutate the project when DeepSeek is unavailable.
 * Ambiguous grid-size edits ask a clarifying question before mutating.
 */

import { normalizeBookStructureSpec, type BookStructureSpec } from './build-book-structure';
import type { AgentToolCallPayload } from './agent-executor';
import type { PlatformSettingsSource } from './platform-settings';
import {
  GENPUZZLE_GENERATOR_IDS,
  parsePuzzleTypesFromText,
} from './puzzle-type-aliases';
import { isAiPuzzleType } from './types';
import type { DocumentPage, PuzzleModuleType } from '@/lib/document-model';
import { FRONT_MATTER_MODULES, PUZZLE_MODULES } from '@/lib/document-model';

export type CopilotClarificationKind = 'apply_scope' | 'font_target' | 'remove_tab';

export interface CopilotClarification {
  kind: CopilotClarificationKind;
  /** Human summary of the intended change (shown again after the user answers). */
  summary: string;
  /** Question shown to the user. */
  question: string;
  /** Tool calls to run after the user answers. */
  pendingToolCalls: AgentToolCallPayload[];
  /** After applying settings, regenerate puzzle grids. */
  regenerateAfter: boolean;
  /** Allowed 1-based tab numbers when kind is remove_tab. */
  allowedTabIndexes?: number[];
}

export interface CopilotInterpretResult {
  toolCalls: AgentToolCallPayload[];
  assistantPreview: string;
  bookSpec?: BookStructureSpec;
  clarification?: CopilotClarification;
}

export interface CopilotInterpretContext {
  platform?: PlatformSettingsSource;
  documentPages?: DocumentPage[];
}

function puzzleTypeLabel(type: string): string {
  return (
    PUZZLE_MODULES.find((m) => m.type === type)?.name ??
    FRONT_MATTER_MODULES.find((m) => m.type === type)?.name ??
    type
  );
}

function buildRemoveTabCall(tabIndex: number): AgentToolCallPayload {
  return {
    id: `local-remove-tab-${tabIndex}`,
    name: 'remove_document_page',
    arguments: JSON.stringify({ tabIndex }),
  };
}

/**
 * Local handler for “remove tab 6” / “delete the crossword tab”.
 */
function interpretRemoveTabCommand(
  text: string,
  pages: DocumentPage[] | undefined
): CopilotInterpretResult | null {
  const lower = text.toLowerCase();

  const mentionsTabOrder =
    /\b(remove|delete|close|drop)\s+(?:the\s+)?(?:tab|document|page)\b/.test(lower) ||
    /\b(?:tab|document|page)\s*(?:#|n[oº°]?\s*)?\d+\b/.test(lower);

  const mentionsTypeRemove =
    /\b(remove|delete|close|drop)\s+(?:the\s+|this\s+|all\s+)?(crosswords?|word\s*searches?|sudokus?|mazes?|cryptograms?|word\s*scrambles?|scramble|trivias?|murdokus?|binairos?|kakuros?|fills?|snakes?|codewords?|title\s*pages?|table\s*of\s*contents|\btoc\b|introductions?|instructions?)\b/.test(
      lower
    );

  // Avoid stealing edit phrases like “remove diagonals from the word search”.
  const looksLikeSettingEdit =
    /\b(diagonal|font|column|margin|color|size|direction|letter|spacing|gap|bleed|frame)\b/.test(
      lower
    ) && !mentionsTabOrder;

  if ((!mentionsTabOrder && !mentionsTypeRemove) || looksLikeSettingEdit) {
    return null;
  }

  const docs = pages ?? [];
  if (docs.length === 0) {
    return {
      toolCalls: [],
      assistantPreview: '📭 No open tabs to remove.',
    };
  }

  // Explicit tab order: “remove tab 6”, “delete document 3”, “close page #2”
  const tabIndexMatch =
    lower.match(
      /\b(?:remove|delete|close|drop)\s+(?:the\s+)?(?:tab|document|page)\s*(?:#|n[oº°]?\s*)?(\d+)\b/
    ) || lower.match(/\b(?:tab|document|page)\s*(?:#|n[oº°]?\s*)?(\d+)\b/);

  if (tabIndexMatch) {
    const tabIndex = Math.round(Number(tabIndexMatch[1]));
    if (!Number.isFinite(tabIndex) || tabIndex < 1 || tabIndex > docs.length) {
      return {
        toolCalls: [],
        assistantPreview: `🤔 No tab **${tabIndex}** — open tabs are **1–${docs.length}**.`,
      };
    }
    const page = docs[tabIndex - 1];
    return {
      toolCalls: [buildRemoveTabCall(tabIndex)],
      assistantPreview: `🗑️ Removing tab **${tabIndex}** — ${page?.name || page?.moduleType || 'document'}…`,
    };
  }

  if (!mentionsTypeRemove) return null;

  // By puzzle/document type: “remove crossword”, “delete the word search”
  const types = parsePuzzleTypesFromText(text).filter((t) =>
    docs.some((p) => p.moduleType === t)
  );
  let moduleType: PuzzleModuleType | string | null = types[0] ?? null;
  if (!moduleType) {
    if (/\btitle\s*page\b/.test(lower)) moduleType = 'title-page';
    else if (/\btable\s*of\s*contents|\btoc\b/.test(lower)) moduleType = 'table-of-contents';
    else if (/\bintroduction\b/.test(lower)) moduleType = 'introduction';
    else if (/\binstructions?\b/.test(lower)) moduleType = 'instructions';
  }
  if (!moduleType) return null;

  const matches = docs
    .map((page, index) => ({ page, tabIndex: index + 1 }))
    .filter(({ page }) => page.moduleType === moduleType);

  if (matches.length === 0) {
    return {
      toolCalls: [],
      assistantPreview: `📭 No **${puzzleTypeLabel(String(moduleType))}** tab open.`,
    };
  }

  if (matches.length === 1) {
    const { page, tabIndex } = matches[0];
    return {
      toolCalls: [buildRemoveTabCall(tabIndex)],
      assistantPreview: `🗑️ Removing tab **${tabIndex}** — ${page.name || puzzleTypeLabel(String(moduleType))}…`,
    };
  }

  const list = matches
    .map(({ page, tabIndex }) => `• **${tabIndex}** — ${page.name || puzzleTypeLabel(String(moduleType))}`)
    .join('\n');
  const allowed = matches.map((m) => m.tabIndex);
  return {
    toolCalls: [],
    assistantPreview: `Which **${puzzleTypeLabel(String(moduleType))}** tab?`,
    clarification: {
      kind: 'remove_tab',
      summary: `🗑️ Several **${puzzleTypeLabel(String(moduleType))}** tabs:`,
      question: `${list}\n\nReply with the **tab number**.`,
      pendingToolCalls: [],
      regenerateAfter: false,
      allowedTabIndexes: allowed,
    },
  };
}

function parseChapterCount(text: string): number | null {
  const m =
    text.match(/\b(?:make|create|add|with)\s+(\d+)\s+chapters?\b/i) ||
    text.match(/\b(\d+)\s+chapters?\b/i) ||
    text.match(/\bchapters?\s*[:=]\s*(\d+)\b/i);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(40, n);
}

function mentionsScope(text: string): 'active' | 'all' | null {
  const lower = text.toLowerCase();
  if (
    /\b(all\s+word\s*search|every\s+word\s*search|all\s+pages|entire\s+book|whole\s+book|everywhere|all\s+puzzles)\b/.test(
      lower
    ) ||
    (/\b(2|two)\b/.test(lower) && /\ball\b/.test(lower))
  ) {
    return 'all';
  }
  if (
    /\b(this\s+page|current\s+page|this\s+puzzle|only\s+this|just\s+this|active\s+page)\b/.test(
      lower
    ) ||
    (/^\s*(1|one|this)\s*$/i.test(text.trim()) && text.trim().length < 12)
  ) {
    return 'active';
  }
  if (/^\s*(2|all)\s*$/i.test(text.trim())) return 'all';
  if (/^\s*(1|this)\s*$/i.test(text.trim())) return 'active';
  return null;
}

type FontTarget = 'titles' | 'word_list' | 'grid' | 'selected' | 'all_page';

function parseFontTarget(text: string): FontTarget | null {
  const lower = text.toLowerCase();
  if (
    /\b(grid\s*letters?|letters?\s+in(?:side)?\s+the\s+grid|word\s*search\s+grid|puzzle\s+grid\s+font|grid\s+font)\b/.test(
      lower
    )
  ) {
    return 'grid';
  }
  if (/\b(selected|selection|page\s*variable|canvas\s*text)\b/.test(lower)) return 'selected';
  if (/\b(word\s*list|words?\s+tab|list\s+font)\b/.test(lower)) return 'word_list';
  if (/\b(title|titles|puzzle\s+title)\b/.test(lower)) return 'titles';
  if (/\b(all\s+of\s+the\s+above|everything\s+on\s+this\s+page|all\s+text)\b/.test(lower)) {
    return 'all_page';
  }
  if (/^\s*(1|titles?)\s*$/i.test(text.trim())) return 'titles';
  if (/^\s*(2|word\s*list)\s*$/i.test(text.trim())) return 'word_list';
  if (/^\s*(3|grid|letters?)\s*$/i.test(text.trim())) return 'grid';
  if (/^\s*(4|selected)\s*$/i.test(text.trim())) return 'selected';
  if (/^\s*(5|all)\s*$/i.test(text.trim())) return 'all_page';
  return null;
}

function buildFontToolCalls(pt: number, target: FontTarget) {
  const toolCalls: AgentToolCallPayload[] = [];
  const notes: string[] = [];
  if (target === 'titles' || target === 'all_page') {
    toolCalls.push({
      id: 'local-titles-font',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'titles',
        setting_name: 'puzzleTitleFontSize',
        value: pt,
      }),
    });
    notes.push(`puzzle titles → ${pt}pt`);
  }
  if (target === 'word_list' || target === 'all_page') {
    toolCalls.push({
      id: 'local-wordlist-font',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'words',
        setting_name: 'wordListFontSize',
        value: pt,
      }),
    });
    notes.push(`word list → ${pt}pt`);
  }
  if (target === 'grid' || target === 'all_page') {
    toolCalls.push({
      id: 'local-grid-font',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'titles',
        setting_name: 'puzzleGridFontSize',
        value: pt,
      }),
    });
    notes.push(`grid letters → ${pt}pt`);
  }
  if (target === 'selected' || target === 'all_page') {
    toolCalls.push({
      id: 'local-selected-font',
      name: 'batch_update_elements',
      arguments: JSON.stringify({
        selector: { scope: 'selected' },
        changes: { fontSize: pt },
      }),
    });
    notes.push(`selected text → ${pt}pt`);
  }
  return { toolCalls, notes };
}

function bumpSpacing(current: number, direction: 'up' | 'down', max = 120): number {
  if (direction === 'down') return Math.max(0, current - 16);
  // Sensible bump: at least +24, and never leave tiny gaps that still overlap.
  return Math.min(max, Math.max(current + 24, current < 28 ? 48 : current + 24));
}

function buildSpacingToolCalls(
  message: string,
  ctx?: CopilotInterpretContext
): { toolCalls: AgentToolCallPayload[]; notes: string[] } | null {
  const lower = message.toLowerCase();
  if (!/(space|spacing|gap|overlap|overlapping)/i.test(lower)) return null;
  if (!/(title|fun\s*fact|subtitle|puzzle|grid)/i.test(lower)) return null;
  // Avoid treating "grid size" requests as spacing.
  if (/\bgrid\s*size\b|\d+\s*[x×]\s*\d+/.test(lower) && !/(space|spacing|gap|overlap)/.test(lower)) {
    return null;
  }

  const ty = ctx?.platform?.wordSearchSettings.typography;
  const funFactToPuzzle =
    /(?:fun\s*fact|subtitle).*(?:puzzle|grid)|(?:puzzle|grid).*(?:fun\s*fact|subtitle)/.test(lower) &&
    !/title/.test(lower);
  const titleToFunFact =
    /(?:title).*(?:fun\s*fact|subtitle)|(?:fun\s*fact|subtitle).*(?:title)/.test(lower);

  let setting_name = 'spaceBetweenTitleAndPuzzle';
  let label = 'space between title and puzzle';
  let current = ty?.spaceBetweenTitleAndPuzzle ?? 20;

  if (funFactToPuzzle) {
    setting_name = 'subtitleToPuzzleGap';
    label = 'space between fun fact and puzzle';
    current = ty?.subtitleToPuzzleGap ?? 10;
  } else if (titleToFunFact) {
    setting_name = 'subtitleToTitleGap';
    label = 'space between title and fun fact';
    current = ty?.subtitleToTitleGap ?? 10;
  }

  const explicit = lower.match(/(?:to\s*|set\s*(?:it\s*)?(?:to\s*)?)(\d+)\s*(?:pt|px|points?)?\b/);
  const wantsDown = /decrease|less|smaller|reduce|shrink/.test(lower);
  const wantsUp =
    /increase|more|add|bigger|larger|clear|avoid|sensible|widen|extra|raise/.test(lower) ||
    (!explicit && !wantsDown);

  let next: number;
  if (explicit && !/increase|decrease|more|less|add/.test(lower)) {
    next = Math.max(0, Math.min(120, Number(explicit[1])));
  } else if (wantsDown) {
    next = bumpSpacing(current, 'down');
  } else {
    next = bumpSpacing(current, 'up');
  }

  if (next === current && wantsUp) next = Math.min(120, current + 24);

  return {
    toolCalls: [
      {
        id: 'local-spacing',
        name: 'update_platform_setting',
        arguments: JSON.stringify({
          category: 'titles',
          setting_name,
          value: next,
        }),
      },
    ],
    notes: [`I'll set ${label} to ${next} (was ${current}).`],
  };
}

function buildPuzzleSettingToolCalls(message: string): {
  toolCalls: AgentToolCallPayload[];
  notes: string[];
  needsRegen: boolean;
} {
  const lower = message.toLowerCase();
  const toolCalls: AgentToolCallPayload[] = [];
  const notes: string[] = [];
  let needsRegen = false;

  // Prefer "20 x 20 grid size" over catching font "20 pt" as a 1D grid size.
  const isFontPt = /\b\d+\s*pt\b/.test(lower) && !/\d+\s*[x×]\s*\d+/.test(lower);
  const gridMatch = isFontPt
    ? null
    : lower.match(/(\d+)\s*[x×]\s*(\d+)\s*(?:grid|letters?|puzzle)?/) ||
      lower.match(/letters?\s*(?:across|wide)?\s*(\d+).*letters?\s*(?:down|high)?\s*(\d+)/) ||
      lower.match(/grid\s*size\s*(?:to\s*|of\s*)?(\d+)\s*[x×]\s*(\d+)/) ||
      lower.match(/(?:make|set)\s+(?:word\s*search\s+)?(?:to\s+)?(\d+)\s*[x×]\s*(\d+)/);

  if (gridMatch) {
    const across = Math.max(5, Math.min(40, Number(gridMatch[1]) || 15));
    const down = Math.max(5, Math.min(40, Number(gridMatch[2] || gridMatch[1]) || across));
    toolCalls.push({
      id: 'local-grid-across',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'puzzle',
        setting_name: 'lettersAcross',
        value: across,
      }),
    });
    toolCalls.push({
      id: 'local-grid-down',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'puzzle',
        setting_name: 'lettersDown',
        value: down,
      }),
    });
    notes.push(`grid ${across}×${down}`);
    needsRegen = true;
  }

  if (/thin\s+border|border\s+thin|reduce\s+border|smaller\s+border/i.test(message)) {
    toolCalls.push({
      id: 'local-border',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'puzzle',
        setting_name: 'borderStrokeThickness',
        value: 1,
      }),
    });
    notes.push('thin border');
  }

  if (/diagonal/i.test(message) && /(on|enable|allow|add|include|hard|complex|with)/i.test(message)) {
    for (const setting_name of [
      'allowDiagonalUp',
      'allowDiagonalDown',
      'allowDiagonalUpReverse',
      'allowDiagonalDownReverse',
    ]) {
      toolCalls.push({
        id: `local-${setting_name}`,
        name: 'update_platform_setting',
        arguments: JSON.stringify({ category: 'puzzle', setting_name, value: true }),
      });
    }
    notes.push('diagonal directions');
    needsRegen = true;
  }

  return { toolCalls, notes, needsRegen };
}

/**
 * Resolve a prior clarification using the user's follow-up message.
 * Returns null when the message does not answer the pending question.
 */
export function resolveCopilotClarification(
  message: string,
  pending: CopilotClarification,
  ctx?: CopilotInterpretContext
): CopilotInterpretResult | null {
  const text = (message || '').normalize('NFC').trim();
  if (!text) return null;

  if (pending.kind === 'apply_scope') {
    const scope = mentionsScope(text);
    if (!scope) return null;
    const toolCalls = [...pending.pendingToolCalls];
    if (scope === 'all') {
      toolCalls.push({
        id: 'local-propagate-all-ws',
        name: 'propagate_word_search_settings',
        arguments: JSON.stringify({ applyToAllWordSearch: true }),
      });
    }
    if (pending.regenerateAfter) {
      toolCalls.push({
        id: 'local-regen',
        name: 'regenerate_puzzles',
        arguments: JSON.stringify({
          confirmed: true,
          applyToAllWordSearch: scope === 'all',
        }),
      });
    }
    return {
      toolCalls,
      assistantPreview:
        scope === 'all'
          ? `${pending.summary} Applying to all Word Search puzzles and regenerating.`
          : `${pending.summary} Applying to this page only and regenerating.`,
    };
  }

  if (pending.kind === 'font_target') {
    const target = parseFontTarget(text);
    if (!target) return null;
    const ptMatch = pending.summary.match(/(\d+)\s*pt/i);
    const pt = Math.max(8, Math.min(72, Number(ptMatch?.[1]) || 20));
    const built = buildFontToolCalls(pt, target);
    if (built.toolCalls.length === 0) return null;
    return {
      toolCalls: built.toolCalls,
      assistantPreview: `✅ Updating ${built.notes.join(', ')}.`,
    };
  }

  if (pending.kind === 'remove_tab') {
    const numMatch = text.match(/(\d+)/);
    if (!numMatch) return null;
    const tabIndex = Math.round(Number(numMatch[1]));
    if (
      pending.allowedTabIndexes?.length &&
      !pending.allowedTabIndexes.includes(tabIndex)
    ) {
      return {
        toolCalls: [],
        assistantPreview: `🤔 Pick one of: ${pending.allowedTabIndexes.map((n) => `**${n}**`).join(', ')}.`,
      };
    }
    return {
      toolCalls: [buildRemoveTabCall(tabIndex)],
      assistantPreview: `🗑️ Removing tab **${tabIndex}**…`,
    };
  }

  // If the pending question is stale, allow spacing/font local paths to take over via caller.
  void ctx;
  return null;
}

/**
 * Convert a natural-language editor request into tool calls when possible.
 * Returns null when the request should go to DeepSeek only.
 */
export function interpretCopilotCommand(
  message: string,
  ctx?: CopilotInterpretContext
): CopilotInterpretResult | null {
  const text = (message || '').normalize('NFC').trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const removeTab = interpretRemoveTabCommand(text, ctx?.documentPages);
  if (removeTab) return removeTab;

  const chapterCount = parseChapterCount(text);
  const puzzleTypes = parsePuzzleTypesFromText(text);
  const everyChapter =
    /every\s+chapter|each\s+chapter|per\s+chapter|to\s+every\s+chapter/i.test(text);
  const wantsFrontMatter =
    /title\s*page|table\s*of\s*contents|\btoc\b|introduction|instructions|this book belongs/i.test(
      text
    ) ||
    (chapterCount != null && puzzleTypes.length > 0) ||
    (everyChapter && puzzleTypes.length > 0);

  const solutionsMatch = lower.match(/(\d+)\s+solutions?\s+per\s+page/);
  const fontMatch =
    lower.match(/(?:font(?:\s+size)?|text)\s*(?:to\s*(?:be\s*)?)?(\d+)\s*(?:pt|points?)?/) ||
    lower.match(/(?:at\s+least|minimum|min(?:imum)?\s+font(?:\s+size)?)\s*(\d+)/) ||
    lower.match(/titles?\s+(?:with\s+)?(\d+)\s*(?:pt|points?)/) ||
    lower.match(/make\s+(?:it|them|the\s+\w+)\s+(\d+)\s*pt/) ||
    lower.match(/(\d+)\s*pt\b/);

  const toolCalls: AgentToolCallPayload[] = [];
  const notes: string[] = [];

  if (
    (chapterCount != null || everyChapter) &&
    (puzzleTypes.length > 0 || wantsFrontMatter)
  ) {
    const spec = normalizeBookStructureSpec({
      chapterCount: chapterCount ?? 4,
      puzzleTypesPerChapter: puzzleTypes,
      includeTitlePage: true,
      includeToc: true,
      includeIntroduction: true,
      includeInstructions: true,
      puzzlesPerTypeDocument: 1,
      replaceExisting: true,
    });
    toolCalls.push({
      id: 'local-build-book',
      name: 'build_book_structure',
      arguments: JSON.stringify({ spec, confirmed: true }),
    });
    notes.push(
      `I'll build ${spec.chapterCount} chapter(s)` +
        (puzzleTypes.length
          ? ` with ${puzzleTypes.join(', ')} in each chapter`
          : '') +
        ', plus Title Page, Table of Contents, Introduction, and Instructions.'
    );
  } else if (chapterCount != null) {
    toolCalls.push({
      id: 'local-chapters',
      name: 'manage_chapters',
      arguments: JSON.stringify({ action: 'set_count', count: chapterCount }),
    });
    notes.push(`I'll create ${chapterCount} chapters via the Chapters system.`);
  }

  if (solutionsMatch && !toolCalls.some((t) => t.name === 'build_book_structure')) {
    toolCalls.push({
      id: 'local-solutions',
      name: 'update_solution_settings',
      arguments: JSON.stringify({
        solutionsPerPage: Math.max(1, Math.min(9, Number(solutionsMatch[1]) || 4)),
        applyToAllDocuments: true,
      }),
    });
  }

  // Word-list columns (e.g. "make the word lists 3 column")
  const colMatch =
    lower.match(/(\d+)\s*[- ]*columns?/) ||
    lower.match(/columns?\s*(?:to\s*|of\s*|=\s*)?(\d+)/);
  if (
    colMatch &&
    /column/.test(lower) &&
    !toolCalls.some((t) => t.name === 'build_book_structure')
  ) {
    const cols = Math.max(1, Math.min(4, Number(colMatch[1]) || 2));
    toolCalls.push({
      id: 'local-wordlist-columns',
      name: 'update_platform_setting',
      arguments: JSON.stringify({
        category: 'words',
        setting_name: 'wordListColumns',
        value: cols,
      }),
    });
    notes.push(`I'll set the word list to ${cols} columns on the Words tab.`);
  }

  // Spacing / overlap gaps — apply immediately (default: this page).
  if (!toolCalls.some((t) => t.name === 'build_book_structure')) {
    const spacing = buildSpacingToolCalls(text, ctx);
    if (spacing) {
      toolCalls.push(...spacing.toolCalls);
      notes.push(...spacing.notes);
    }
  }

  // Font changes: if the user named the target (esp. grid letters), apply now.
  if (
    fontMatch &&
    /font|pt|points?/i.test(text) &&
    !toolCalls.some((t) => t.name === 'build_book_structure')
  ) {
    const pt = Math.max(8, Math.min(72, Number(fontMatch[1]) || 20));
    const explicitTarget = parseFontTarget(text);
    const titleHint = /title/i.test(text) && !/grid/i.test(text) ? 'titles' : null;
    const target = explicitTarget || titleHint;
    if (!target) {
      // Only ask when truly ambiguous — and include grid letters as option 3.
      return {
        toolCalls: [],
        assistantPreview: '',
        clarification: {
          kind: 'font_target',
          summary: `Set font size to ${pt}pt`,
          question:
            `Which text should I set to ${pt}pt?\n` +
            `1) Puzzle titles (Titles tab)\n` +
            `2) Word list (Words tab)\n` +
            `3) Grid letters (canvas Grid Letters / Puzzle tab)\n` +
            `4) Selected canvas text / page variables\n` +
            `5) All of the above on this page\n\n` +
            `Reply with 1–5 (or “titles”, “word list”, “grid”, “selected”).`,
          pendingToolCalls: [],
          regenerateAfter: false,
        },
      };
    }
    const built = buildFontToolCalls(pt, target);
    toolCalls.push(...built.toolCalls);
    notes.push(`I'll update ${built.notes.join(', ')}.`);
  }

  const puzzleEdits = buildPuzzleSettingToolCalls(text);
  if (puzzleEdits.toolCalls.length > 0 && !toolCalls.some((t) => t.name === 'build_book_structure')) {
    const scope = mentionsScope(text);
    // Only ask scope for grid-size / direction changes that need regenerate.
    if (!scope && puzzleEdits.needsRegen) {
      return {
        toolCalls: [],
        assistantPreview: '',
        clarification: {
          kind: 'apply_scope',
          summary: `I'll apply: ${puzzleEdits.notes.join(', ')}.`,
          question:
            `Should I apply this to:\n` +
            `1) This page only\n` +
            `2) All Word Search puzzles in the book\n\n` +
            `Reply with “this page” or “all word search”.`,
          pendingToolCalls: puzzleEdits.toolCalls,
          regenerateAfter: true,
        },
      };
    }

    toolCalls.push(...puzzleEdits.toolCalls);
    notes.push(`I'll apply: ${puzzleEdits.notes.join(', ')}.`);
    const effectiveScope = scope ?? 'active';
    if (effectiveScope === 'all') {
      toolCalls.push({
        id: 'local-propagate-all-ws',
        name: 'propagate_word_search_settings',
        arguments: JSON.stringify({ applyToAllWordSearch: true }),
      });
      notes.push('Scope: all Word Search puzzles.');
    } else if (puzzleEdits.needsRegen) {
      notes.push('Scope: this page only.');
    }
    if (puzzleEdits.needsRegen) {
      toolCalls.push({
        id: 'local-regen',
        name: 'regenerate_puzzles',
        arguments: JSON.stringify({
          confirmed: true,
          applyToAllWordSearch: effectiveScope === 'all',
        }),
      });
      notes.push('Then regenerate the puzzles.');
    }
  }

  if (
    toolCalls.length === 0 &&
    puzzleTypes.length > 0 &&
    /\b(add|include|create|insert|make)\b/i.test(text) &&
    !everyChapter &&
    chapterCount == null &&
    !/\bchapters?\b/i.test(text)
  ) {
    // “add word search and crossword tabs” → insert those tabs only
    toolCalls.push({
      id: 'local-insert-tabs',
      name: 'insert_document_tabs',
      arguments: JSON.stringify({
        types: puzzleTypes,
        position: 'after',
      }),
    });
    const pretty = puzzleTypes.map((t) => t.replace(/-/g, ' ')).join(' + ');
    notes.push(`✨ Adding **${pretty}** tab${puzzleTypes.length === 1 ? '' : 's'}…`);
  } else if (
    toolCalls.length === 0 &&
    puzzleTypes.length > 0 &&
    /add|include|use|each chapter|every chapter/i.test(text)
  ) {
    const spec = normalizeBookStructureSpec({
      chapterCount: Math.max(1, chapterCount ?? 1),
      puzzleTypesPerChapter: puzzleTypes,
      includeTitlePage: true,
      includeToc: true,
      includeIntroduction: true,
      includeInstructions: true,
      replaceExisting: false,
    });
    toolCalls.push({
      id: 'local-add-types',
      name: 'build_book_structure',
      arguments: JSON.stringify({ spec, confirmed: true }),
    });
    notes.push(
      `I'll add document tabs for: ${puzzleTypes.join(', ')} (known generators: ${GENPUZZLE_GENERATOR_IDS.join(', ')}).`
    );
  }

  if (toolCalls.length === 0) return null;

  for (const call of toolCalls) {
    if (call.name !== 'build_book_structure') continue;
    try {
      const args = JSON.parse(call.arguments) as { spec?: { puzzleTypesPerChapter?: unknown[] } };
      if (args.spec?.puzzleTypesPerChapter) {
        args.spec.puzzleTypesPerChapter = args.spec.puzzleTypesPerChapter.filter((t) =>
          isAiPuzzleType(t)
        );
        call.arguments = JSON.stringify(args);
      }
    } catch {
      // keep original
    }
  }

  return {
    toolCalls,
    assistantPreview: notes.join(' ') || 'Applying structured GenPuzzle actions.',
    bookSpec:
      toolCalls[0]?.name === 'build_book_structure'
        ? normalizeBookStructureSpec(JSON.parse(toolCalls[0].arguments).spec)
        : undefined,
  };
}
