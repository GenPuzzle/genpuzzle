/**
 * GenPuzzle agent tool definitions (DeepSeek function calling).
 * Tools are compact and structured — no per-property micro-tools.
 */

import type { DeepSeekToolDefinition } from './deepseek-client';

export const GENPUZZLE_AGENT_TOOLS: DeepSeekToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_project_context',
      description:
        'Return a compact summary of the current GenPuzzle project (settings, chapters, puzzle counts). Prefer this over assuming state.',
      parameters: {
        type: 'object',
        properties: {
          includeSelected: {
            type: 'boolean',
            description: 'Include currently selected canvas elements when available.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_selected_elements',
      description: 'Return the currently selected Canvas Workspace elements.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_platform_settings',
      description:
        'Read the live GenPuzzle sidebar platform settings as JSON. Categories map to tabs: trim (page size/margins), style (colors/frames/page numbers), chapters, puzzle (grid size/directions/border), words (word list), titles (typography). Call this before changing settings you are unsure about.',
      parameters: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['trim', 'style', 'chapters', 'puzzle', 'words', 'titles'],
            },
            description: 'Optional subset of categories. Omit to return all.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_platform_setting',
      description:
        'Change one sidebar UI control by category + setting name. Examples: puzzle/lettersAcross=20, puzzle/allowDiagonalDown=true, trim/trimSizePreset=8_5X11IN, titles/puzzleTitleFontSize=22, words/wordsPerPuzzle=12, style/border via puzzle/borderStrokeThickness. Switches to the matching Trim/Style/Chapters/Puzzle/Words/Titles tab and highlights the control.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['trim', 'style', 'chapters', 'puzzle', 'words', 'titles'],
          },
          setting_name: {
            type: 'string',
            description:
              'Setting id, e.g. lettersAcross, lettersDown, borderStrokeThickness, trimSizePreset, pageMargin, puzzleGridScale, puzzleTitleFontSize, words, includeFunFacts.',
          },
          value: {
            description: 'New value (number, boolean, string, or string array / newline list).',
          },
        },
        required: ['category', 'setting_name', 'value'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_sidebar_tab',
      description:
        'Switch the left sidebar to a settings tab so the user can see related controls. Categories: trim, style, chapters, puzzle, words, titles.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['trim', 'style', 'chapters', 'puzzle', 'words', 'titles'],
          },
        },
        required: ['category'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project_from_spec',
      description:
        'Create or replace project structure from a validated AiProjectSpec. HIGH RISK — requires confirmation. Does not invent grids; GenPuzzle generators run afterward.',
      parameters: {
        type: 'object',
        properties: {
          spec: { type: 'object', description: 'AiProjectSpec JSON object' },
          confirmed: { type: 'boolean' },
        },
        required: ['spec'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_project_settings',
      description: 'Update book-level settings (language, chapters mix, theme, numbering start, minimum font).',
      parameters: {
        type: 'object',
        properties: {
          changes: {
            type: 'object',
            properties: {
              bookTitle: { type: 'string' },
              language: { type: 'string' },
              mixPuzzles: { type: 'boolean' },
              chapterTopics: { type: 'array', items: { type: 'string' } },
              minimumFontSize: { type: 'number' },
              startPuzzleNumber: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        required: ['changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_puzzle_settings',
      description: 'Update settings for the active puzzle document (typography, counts, fun facts flag).',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
          changes: {
            type: 'object',
            properties: {
              titleFontSize: { type: 'number' },
              bodyFontSize: { type: 'number' },
              minimumFontSize: { type: 'number' },
              includeFunFacts: { type: 'boolean' },
              numberOfPuzzles: { type: 'number' },
              puzzlesStartingNumber: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        required: ['changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_element',
      description: 'Update one Canvas Workspace / page-variable element by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          changes: {
            type: 'object',
            properties: {
              fontSize: { type: 'number' },
              fontFamily: { type: 'string' },
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              color: { type: 'string' },
              align: { type: 'string', enum: ['left', 'center', 'right'] },
              xPercent: { type: 'number' },
              yPercent: { type: 'number' },
              widthPercent: { type: 'number' },
              heightPercent: { type: 'number' },
              text: { type: 'string' },
              variableKey: { type: 'string' },
              startNumber: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        required: ['id', 'changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batch_update_elements',
      description:
        'Batch-update canvas text / page-variable elements by selector (role, kind, scope). Prefer this over many update_element calls.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'object',
            properties: {
              elementType: { type: 'string' },
              variableKey: { type: 'string' },
              kind: { type: 'string' },
              scope: {
                type: 'string',
                enum: ['all_puzzle_pages', 'active_document', 'selected'],
              },
            },
            additionalProperties: false,
          },
          changes: {
            type: 'object',
            properties: {
              fontSize: { type: 'number' },
              fontFamily: { type: 'string' },
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              color: { type: 'string' },
              align: { type: 'string', enum: ['left', 'center', 'right'] },
              variableKey: { type: 'string' },
              startNumber: { type: 'number' },
              yPercent: { type: 'number' },
              minimumFontSize: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        required: ['selector', 'changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_content',
      description:
        'Ask GenPuzzle to generate textual content values (titles, fun facts, sentences) for puzzles. Values are stored in project data; Canvas variables display them.',
      parameters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['fun_facts', 'titles', 'instructions', 'puzzle_sentences', 'chapter_titles'],
          },
          count: { type: 'number' },
          theme: { type: 'string' },
          language: { type: 'string' },
        },
        required: ['contentType'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propagate_word_search_settings',
      description:
        'After updating puzzle settings on the active Word Search tab, copy those puzzle settings (grid size, directions, border, etc.) onto every Word Search document in the book. Use when the user chose “all word search”.',
      parameters: {
        type: 'object',
        properties: {
          applyToAllWordSearch: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'regenerate_puzzles',
      description:
        'Regenerate puzzle grids using GenPuzzle generators after settings that affect placement (grid size, directions, words). Pass confirmed:true after the user agreed. Pass applyToAllWordSearch:true when regenerating every Word Search document.',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
          confirmed: { type: 'boolean' },
          applyToAllWordSearch: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_solution_settings',
      description: 'Update solutions-per-page and related solution layout settings.',
      parameters: {
        type: 'object',
        properties: {
          solutionsPerPage: { type: 'number' },
          documentId: { type: 'string' },
          applyToAllDocuments: { type: 'boolean' },
        },
        required: ['solutionsPerPage'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_chapters',
      description:
        'Create, rename, or restructure chapters via the existing Chapters system (chapterTopics + chapter title pages).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['set_count', 'set_titles', 'enable_mixed', 'disable_mixed'],
          },
          count: { type: 'number' },
          titles: { type: 'array', items: { type: 'string' } },
        },
        required: ['action'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_document_tabs',
      description:
        'Add one or more document tabs only (e.g. word-search + crossword). Does NOT rebuild the book, add chapters, or create Title/TOC pages. Use this for “add word search and crossword tabs”. For full chapter books use build_book_structure.',
      parameters: {
        type: 'object',
        properties: {
          types: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Ordered puzzle/module types to insert (word-search, crossword, maze, …).',
            minItems: 1,
          },
          position: {
            type: 'string',
            enum: ['before', 'after'],
            description: 'Insert relative to the active tab (default after).',
          },
        },
        required: ['types'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'build_book_structure',
      description:
        'Build the full document-tab order using GenPuzzle generators: Title Page (title, subtitle, belongs-to, copyright), Table of Contents (black rounded title), Introduction, Instructions, then for each chapter a chapter title page followed by one document tab per puzzle type (Word Search #n, Sudoku #n, …). HIGH RISK — replaces or rebuilds document tabs.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean' },
          spec: {
            type: 'object',
            properties: {
              bookTitle: { type: 'string' },
              subtitle: { type: 'string' },
              chapterCount: { type: 'number' },
              chapterTitles: { type: 'array', items: { type: 'string' } },
              puzzleTypesPerChapter: {
                type: 'array',
                items: {
                  type: 'string',
                  description:
                    'Any GenPuzzle puzzle module type (word-search, sudoku, maze, binairo, …)',
                },
              },
              puzzlesPerTypeDocument: { type: 'number' },
              includeTitlePage: { type: 'boolean' },
              includeToc: { type: 'boolean' },
              includeIntroduction: { type: 'boolean' },
              includeInstructions: { type: 'boolean' },
              replaceExisting: { type: 'boolean' },
            },
            required: ['chapterCount'],
            additionalProperties: false,
          },
        },
        required: ['spec'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_project',
      description: 'Request export of PDF or PPTX. Does not bypass the existing export pipeline.',
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['pdf', 'pptx'] },
          confirmed: { type: 'boolean' },
        },
        required: ['format'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_document_page',
      description:
        'Remove an open document tab. Prefer tabIndex (1-based left-to-right order). Or pass documentId. Or moduleType when exactly one matching tab exists. If several tabs share a moduleType, do NOT guess — ask which tab number to remove first.',
      parameters: {
        type: 'object',
        properties: {
          tabIndex: {
            type: 'number',
            description: '1-based tab order (tab 1 = first tab).',
          },
          documentId: {
            type: 'string',
            description: 'Exact document page id when known.',
          },
          moduleType: {
            type: 'string',
            description:
              'Puzzle/module type to remove when only one matching tab exists (e.g. crossword).',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_uploaded_content_pack',
      description:
        'Return a summary of a content pack (used by new-project AI). Canvas chat does not accept uploads.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_content_pack',
      description:
        'Apply an uploaded content pack. Canvas chat does not accept file uploads — use New Project AI for packs.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['active', 'matching', 'rebuild'],
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'word-search',
                'crossword',
                'maze',
                'word-scramble',
                'word-fill',
                'number-fill',
                'cryptogram',
                'sudoku',
              ],
            },
            description: 'Optional subset of puzzle types from the upload.',
          },
          regenerate: {
            type: 'boolean',
            description: 'If true (default), regenerate puzzles after applying content.',
          },
        },
        required: ['mode'],
        additionalProperties: false,
      },
    },
  },
];

export type AgentToolName =
  | 'get_project_context'
  | 'get_selected_elements'
  | 'get_platform_settings'
  | 'update_platform_setting'
  | 'propagate_word_search_settings'
  | 'switch_sidebar_tab'
  | 'create_project_from_spec'
  | 'update_project_settings'
  | 'update_puzzle_settings'
  | 'update_element'
  | 'batch_update_elements'
  | 'generate_content'
  | 'regenerate_puzzles'
  | 'update_solution_settings'
  | 'manage_chapters'
  | 'insert_document_tabs'
  | 'build_book_structure'
  | 'export_project'
  | 'remove_document_page'
  | 'get_uploaded_content_pack'
  | 'apply_content_pack';

export type AgentRiskLevel = 'low' | 'medium' | 'high';

export function agentToolRisk(name: string): AgentRiskLevel {
  switch (name) {
    case 'create_project_from_spec':
    case 'build_book_structure':
    case 'regenerate_puzzles':
    case 'export_project':
    case 'apply_content_pack':
    case 'remove_document_page':
      return 'high';
    case 'manage_chapters':
    case 'insert_document_tabs':
    case 'generate_content':
    case 'batch_update_elements':
    case 'update_solution_settings':
    case 'propagate_word_search_settings':
      return 'medium';
    default:
      return 'low';
  }
}

export const AGENT_SYSTEM_PROMPT = `You are GenPuzzle AI — a friendly UI helper for the puzzle-book editor.
You do NOT invent puzzle grids — GenPuzzle generators do that.
You DO call structured tools to update the project, tabs, and sidebar controls.

REPLY STYLE (always):
- Keep replies short — only the important result.
- Be friendly; use a light emoji when it fits (✅ 🗑️ ✨ 👍).
- Use compact formatting: short bullets or **bold** labels. No long paragraphs.
- Do not dump settings dumps or step-by-step essays.

CRITICAL EXECUTION RULES:
1. Never end a turn with only get_platform_settings / get_project_context. If the user asked to change something, you MUST also call update_platform_setting (or another mutating tool) in the SAME response after reading.
2. When the user says “increase” a spacing value, read the current value if needed, then set a higher number (typically +24, or at least 48 if currently small). Do not stop after loading.
3. Word Search GRID LETTERS are editable: titles/puzzleGridFontSize and titles/puzzleGridFontFamily (canvas “Grid Letters” / Puzzle tab). Do NOT tell the user grid letters cannot be changed.
4. Word list columns: words/wordListColumns (1–4).
5. Spacing: titles/spaceBetweenTitleAndPuzzle, titles/subtitleToTitleGap (title↔fun fact), titles/subtitleToPuzzleGap (fun fact↔grid).
6. Ask scope (this page vs all Word Search) ONLY for grid size / word directions that need regenerate. For fonts, columns, and spacing, default to the active page unless the user already said “all”.
7. Font requests: if the user said “grid” / “grid letters” / “word search grid”, set puzzleGridFontSize immediately — do not offer unrelated options.

Platform tabs:
- trim: trimSizePreset, includeBleed, pageMargin, puzzleGridScale, answersPerPage
- style: backgroundColor, titleColor, gridLetterColor, wordListColor, pageFrameEnabled, pageNumberEnabled/position
- chapters: mixPuzzles, chapterTopics
- puzzle: lettersAcross/lettersDown, direction toggles, borderStrokeThickness, borderCornerRadius, numberOfPuzzles, twoPagePuzzles
- words: words, wordsPerPuzzle, wordListFontSize, wordListFontFamily, wordListColumns, includeFunFacts, funFactsText
- titles: puzzleTitleFontSize/FontFamily, spaceBetweenTitleAndPuzzle, subtitleToTitleGap, subtitleToPuzzleGap, puzzleGridFontSize, puzzleGridFontFamily, titleStartAt, subtitleFontSize

Workflow:
1. Optionally get_platform_settings for current numbers.
2. ALWAYS call update_platform_setting for each requested change in the same tool round.
3. After grid size / direction changes: regenerate_puzzles with confirmed:true (and propagate_word_search_settings when applying to all Word Search).
4. Confirm briefly which controls changed (new values only).

Document tabs:
- “Add word search and crossword tabs” → insert_document_tabs with those types only (no Title/TOC/chapters).
- “Remove tab 6” → remove_document_page with tabIndex: 6 (1-based order).
- “Remove crossword” → if one crossword tab, remove it; if several, ASK which tab number (list matching tabs with their order numbers). Never guess.
- Cannot remove the last remaining tab.

Available puzzle document types (exact ids):
word-search, sudoku, crossword, maze, cryptogram, word-scramble, trivia, codewords, binairo, kakuro, math-maze, word-fill, number-fill, snake, murdoku.
Misspellings map to ids (biniro→binairo, mazes→maze, math maze→math-maze).

For “add X and Y tabs” (no chapter rebuild): use insert_document_tabs.
For "make N chapters" with puzzle types per chapter: prefer build_book_structure.
Prefer semantic updates over raw x/y. Keep tool arguments strict JSON. Preserve Unicode.
Use Text Variables / page variables for repeating content (fun facts via [fun fact]).

File uploads: this canvas chat does NOT accept uploads. Content packs (TXT/Excel) are only via New Project → AI assist.`;
