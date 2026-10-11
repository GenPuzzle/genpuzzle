'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/lib/app-context';
import { isPuzzleModuleSettings, PUZZLE_MODULES } from '@/lib/document-model';
import { GENPUZZLE_GENERATOR_IDS } from '@/lib/ai/puzzle-type-aliases';
import {
  executeAgentToolCall,
  type AgentAppBridge,
  type AgentSelectedElement,
  type AgentToolCallPayload,
  type AgentToolResult,
} from '@/lib/ai/agent-executor';
import {
  interpretCopilotCommand,
  resolveCopilotClarification,
  type CopilotClarification,
} from '@/lib/ai/interpret-copilot-command';
import type { PlatformSettingsSource } from '@/lib/ai/platform-settings';
import { mergeWordSearchSettingsUpdate } from '@/lib/visual-settings-sync';
import { normalizePageVariables } from '@/lib/page-variables';
import {
  contentPackForAiContext,
  type ContentPack,
} from '@/lib/ai/content-pack';
import {
  isAbortError,
  runContentPackImport,
  yieldToUi as yieldImportUi,
  type ContentPackAppActions,
} from '@/lib/ai/run-content-pack-import';
import { useOptionalAppBusy } from '@/lib/app-busy-context';

interface ChatRow {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function yieldToUi(): Promise<void> {
  return yieldImportUi();
}

function formatShortChatReply(
  preview: string | undefined,
  results: AgentToolResult[]
): string {
  const failures = results.filter((r) => !r.ok);
  const successes = results.filter((r) => r.ok);

  if (failures.length === 0) {
    if (preview?.trim()) return preview.trim();
    if (successes.length === 1) return successes[0].message;
    if (successes.length > 1) {
      return successes.map((r) => `✅ ${r.message}`).join('\n');
    }
    return '✅ Done.';
  }

  const parts: string[] = [];
  if (preview?.trim()) parts.push(preview.trim());
  for (const r of successes) parts.push(`✅ ${r.message}`);
  for (const r of failures) parts.push(`⚠️ ${r.message}`);
  return parts.join('\n') || '⚠️ Something went wrong.';
}

function clarificationFromRemoveCandidates(
  message: string,
  data: unknown
): CopilotClarification | null {
  const payload = data as
    | {
        needsTabIndex?: boolean;
        candidates?: Array<{ tabIndex: number; name?: string; moduleType?: string }>;
      }
    | undefined;
  if (!payload?.needsTabIndex || !payload.candidates?.length) return null;
  const allowed = payload.candidates.map((c) => c.tabIndex);
  const list = payload.candidates
    .map((c) => `• **${c.tabIndex}** — ${c.name || c.moduleType || 'tab'}`)
    .join('\n');
  return {
    kind: 'remove_tab',
    summary: message.split('\n\nWhich')[0] || '🗑️ Several matching tabs:',
    question: `${list}\n\nReply with the **tab number**.`,
    pendingToolCalls: [],
    regenerateAfter: false,
    allowedTabIndexes: allowed,
  };
}

export function AiCopilotPanel({
  open,
  onClose,
  selectedElements = [],
}: {
  open: boolean;
  onClose: () => void;
  selectedElements?: AgentSelectedElement[];
}) {
  const app = useApp();
  const appBusy = useOptionalAppBusy();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingClarification, setPendingClarification] = useState<CopilotClarification | null>(
    null
  );
  const contentPackRef = useRef<ContentPack | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<ChatRow[]>([
    {
      role: 'assistant',
      content:
        'Hi! ✨ What should we tweak?\n\n• Grid **20×20** with diagonals\n• Grid letters **20pt**\n• Word list **3 columns**\n• Remove **tab 6** / remove crossword\n\nKeep it short — I’ve got you 👍',
    },
  ]);

  const platformSourceRef = useRef<PlatformSettingsSource>({
    wordSearchSettings: app.wordSearchSettings,
    titleWords: app.titleWords,
    bookSettings: app.bookSettings,
    pageMargin: app.pageMargin,
    puzzleGridScale: app.puzzleGridScale,
  });
  const lastPropagatedPagesRef = useRef<typeof app.documentPages | null>(null);

  useEffect(() => {
    platformSourceRef.current = {
      wordSearchSettings: app.wordSearchSettings,
      titleWords: app.titleWords,
      bookSettings: app.bookSettings,
      pageMargin: app.pageMargin,
      puzzleGridScale: app.puzzleGridScale,
    };
  }, [
    app.wordSearchSettings,
    app.titleWords,
    app.bookSettings,
    app.pageMargin,
    app.puzzleGridScale,
  ]);

  const availablePuzzleTypes = useMemo(
    () =>
      GENPUZZLE_GENERATOR_IDS.map((type) => ({
        type,
        label: PUZZLE_MODULES.find((m) => m.type === type)?.name ?? type,
      })),
    []
  );

  const bridge: AgentAppBridge = useMemo(
    () => ({
      getProjectContext: () => {
        const docs = app.documentPages.map((page) => {
          const settings = isPuzzleModuleSettings(page.settings) ? page.settings : null;
          return {
            id: page.id,
            name: page.name,
            moduleType: page.moduleType,
            puzzleCount:
              settings?.wordSearchSettings?.core.numberOfPuzzles ??
              settings?.genericPuzzleSettings?.core.numberOfPuzzles ??
              settings?.crosswordSettings?.core.numberOfPuzzles,
            solutionsPerPage:
              settings?.genericPuzzleSettings?.core.solutionsPerPage ??
              settings?.wordSearchSettings?.bookCanvas.answersPerPage,
            includeFunFacts:
              settings?.wordSearchSettings?.typography.includeFunFacts ??
              settings?.genericPuzzleSettings?.typography.includeFunFacts,
            titleFontSize:
              settings?.wordSearchSettings?.typography.puzzleTitleFontSize ??
              settings?.genericPuzzleSettings?.typography.puzzleTitleFontSize,
          };
        });
        return {
          bookTitle: app.projectName,
          language: undefined,
          mixPuzzles: !!app.bookSettings?.mixPuzzles,
          chapterTopics: app.bookSettings?.chapterTopics,
          documents: docs,
          activeDocumentId: app.activeDocumentPageId,
          puzzleCountEstimate: docs.reduce((sum, d) => sum + (d.puzzleCount || 0), 0),
          availablePuzzleTypes,
        };
      },
      getSelectedElements: () => selectedElements,
      getActiveDocument: () =>
        app.documentPages.find((p) => p.id === app.activeDocumentPageId) ?? null,
      getDocumentPages: () => app.documentPages,
      updateDocumentPage: (id, patch) => app.updateDocumentPage(id, patch),
      setBookSettings: (patch) => {
        const next = { ...app.bookSettings, ...patch };
        platformSourceRef.current = {
          ...platformSourceRef.current,
          bookSettings: next as PlatformSettingsSource['bookSettings'],
        };
        app.setBookSettings(next);
      },
      getBookSettings: () => ({ ...platformSourceRef.current.bookSettings }),
      pushUndoSnapshot: () => {
        app.pushEditHistory();
      },
      undo: () => app.undo(),
      replaceDocumentPages: (pages, activeId) => {
        lastPropagatedPagesRef.current = pages;
        app.replaceDocumentPages(pages, activeId);
      },
      insertDocumentPage: (type, position, referenceId) =>
        app.insertDocumentPage(type as never, position, referenceId),
      removeDocumentPage: (id) => app.removeDocumentPage(id),
      setProjectName: (name) => app.setProjectName(name),
      getPlatformSettingsSource: () => platformSourceRef.current,
      updateWordSearchSettings: (patch, options) => {
        const merged = mergeWordSearchSettingsUpdate(
          platformSourceRef.current.wordSearchSettings,
          patch
        );
        platformSourceRef.current = {
          ...platformSourceRef.current,
          wordSearchSettings: merged,
        };
        app.updateWordSearchSettings(patch, { recordHistory: options?.recordHistory ?? false });
      },
      propagateWordSearchSettingsToAllDocuments: () => {
        const live = platformSourceRef.current.wordSearchSettings;
        const pages = app.documentPages.map((page) => {
          if (page.moduleType !== 'word-search' || !isPuzzleModuleSettings(page.settings)) {
            return page;
          }
          const current = page.settings.wordSearchSettings;
          if (!current) return page;
          return {
            ...page,
            settings: {
              ...page.settings,
              wordSearchSettings: mergeWordSearchSettingsUpdate(current, {
                core: live.core,
                wordList: {
                  wordsPerPuzzle: live.wordList.wordsPerPuzzle,
                  wordListFontSize: live.wordList.wordListFontSize,
                  wordListFontFamily: live.wordList.wordListFontFamily,
                  wordListColumns: live.wordList.wordListColumns,
                } as typeof live.wordList,
                typography: {
                  puzzleGridFontSize: live.typography.puzzleGridFontSize,
                  puzzleGridFontFamily: live.typography.puzzleGridFontFamily,
                  puzzleTitleFontSize: live.typography.puzzleTitleFontSize,
                  puzzleTitleFontFamily: live.typography.puzzleTitleFontFamily,
                  spaceBetweenTitleAndPuzzle: live.typography.spaceBetweenTitleAndPuzzle,
                  subtitleToTitleGap: live.typography.subtitleToTitleGap,
                  subtitleToPuzzleGap: live.typography.subtitleToPuzzleGap,
                  subtitleFontSize: live.typography.subtitleFontSize,
                } as typeof live.typography,
              }),
            },
          };
        });
        lastPropagatedPagesRef.current = pages;
        app.replaceDocumentPages(pages, app.activeDocumentPageId);
      },
      setTitleWords: (next) => {
        platformSourceRef.current = { ...platformSourceRef.current, titleWords: next };
        app.setTitleWords(next);
      },
      setPageMargin: (value) => {
        platformSourceRef.current = { ...platformSourceRef.current, pageMargin: value };
        app.setPageMargin(value);
      },
      setPuzzleGridScale: (value) => {
        platformSourceRef.current = { ...platformSourceRef.current, puzzleGridScale: value };
        app.setPuzzleGridScale(value);
      },
      applyTrimSizeLayoutChange: (bookCanvasUpdates) =>
        app.applyTrimSizeLayoutChange(bookCanvasUpdates),
      setActiveDocumentPageId: (id) => app.setActiveDocumentPageId(id),
      setCrosswordSettings: (settings) => app.setCrosswordSettings(settings),
      setGenericPuzzleSettings: (settings) => app.setGenericPuzzleSettings(settings),
      requestRegenerate: async (_documentId, options) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        let busyShown = false;
        const ensureBusy = (label: string, progress?: number) => {
          if (!busyShown) {
            appBusy.showBusy(label, progress, {
              onCancel: () => {
                controller.abort();
                appBusy.updateBusy({ label: 'Cancelling…' });
              },
            });
            busyShown = true;
          } else {
            appBusy.updateBusy({ label, progress });
          }
        };
        const clearBusy = () => {
          if (busyShown) {
            appBusy.hideBusy();
            busyShown = false;
          }
        };
        try {
          ensureBusy('Generating puzzles…', 8);
          await yieldToUi();
          if (options?.applyToAllWordSearch) {
            const sourcePages = lastPropagatedPagesRef.current ?? app.documentPages;
            const wsPages = sourcePages.filter((p) => p.moduleType === 'word-search');
            lastPropagatedPagesRef.current = null;
            if (wsPages.length) {
              ensureBusy('Generating Word Search…', 30);
              await app.regenerateWordSearchDocuments(wsPages);
            }
          }
          if (controller.signal.aborted) {
            clearBusy();
            return { ok: false, error: 'Cancelled.' };
          }
          ensureBusy('Generating active puzzle…', 70);
          await app.generatePuzzle({ clearPageCustomizations: true });
          clearBusy();
          return { ok: true };
        } catch (error) {
          clearBusy();
          if (isAbortError(error) || controller.signal.aborted) {
            return { ok: false, error: 'Cancelled.' };
          }
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'Could not regenerate puzzles.',
          };
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
        }
      },
      getContentPack: () => contentPackRef.current,
    }),
    [app, appBusy, availablePuzzleTypes, selectedElements]
  );

  const contentPackAppActions = useCallback((): ContentPackAppActions => {
    return {
      getDocumentPages: () => lastPropagatedPagesRef.current ?? app.documentPages,
      replaceDocumentPages: (pages, activeId) => {
        lastPropagatedPagesRef.current = pages;
        app.replaceDocumentPages(pages, activeId);
      },
      setBookSettings: (patch) => {
        const next = { ...app.bookSettings, ...patch };
        platformSourceRef.current = {
          ...platformSourceRef.current,
          bookSettings: next as PlatformSettingsSource['bookSettings'],
        };
        app.setBookSettings(next);
      },
      getBookSettings: () => ({ ...platformSourceRef.current.bookSettings }),
      setProjectName: (name) => app.setProjectName(name),
      setTitleWords: (next) => {
        platformSourceRef.current = { ...platformSourceRef.current, titleWords: next };
        app.setTitleWords(next);
      },
      setActiveDocumentPageId: (id) => app.setActiveDocumentPageId(id),
      setCrosswordSettings: (settings) => app.setCrosswordSettings(settings),
      setGenericPuzzleSettings: (settings) => app.setGenericPuzzleSettings(settings),
      updateWordSearchSettings: (patch, options) => {
        const merged = mergeWordSearchSettingsUpdate(
          platformSourceRef.current.wordSearchSettings,
          patch
        );
        platformSourceRef.current = {
          ...platformSourceRef.current,
          wordSearchSettings: merged,
        };
        app.updateWordSearchSettings(patch, { recordHistory: options?.recordHistory ?? false });
      },
      regenerateWordSearchDocuments: (pages) => app.regenerateWordSearchDocuments(pages),
      generatePuzzle: (options) => app.generatePuzzle(options),
      pushEditHistory: () => app.pushEditHistory(),
    };
  }, [app]);

  const applyUploadedContentPack = useCallback(
    async (
      mode: 'active' | 'matching' | 'rebuild',
      types?: import('@/lib/ai/content-pack').ContentPackPuzzleKind[]
    ) => {
      const pack = contentPackRef.current;
      if (!pack) {
        return {
          ok: false,
          message: '📎 Uploads aren’t available here — use **New Project → AI**.',
        };
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      appBusy.showBusy('Copying words, clues & fun facts…', 2, {
        onCancel: () => {
          controller.abort();
          appBusy.updateBusy({ label: 'Cancelling…' });
        },
      });

      try {
        const result = await runContentPackImport({
          pack,
          mode,
          kinds: types,
          app: contentPackAppActions(),
          bookTitle: app.projectName,
          activeDocumentId: app.activeDocumentPageId,
          signal: controller.signal,
          onProgress: (label, progressPct) => {
            appBusy.updateBusy({
              label,
              progress: progressPct,
              onCancel: () => {
                controller.abort();
                appBusy.updateBusy({ label: 'Cancelling…' });
              },
            });
          },
          generate: true,
        });
        if (controller.signal.aborted) {
          return { ok: false, message: 'Cancelled.' };
        }
        return result;
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return { ok: false, message: 'Cancelled.' };
        }
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Could not apply the upload.',
        };
      } finally {
        appBusy.hideBusy();
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [app, appBusy, contentPackAppActions]
  );

  const runToolCalls = useCallback(
    async (toolCalls: AgentToolCallPayload[]) => {
      const results = [];
      // One undo snapshot for the whole batch so the UI does not freeze on N history clones.
      if (
        toolCalls.some(
          (c) =>
            c?.name &&
            c.name !== 'get_platform_settings' &&
            c.name !== 'get_project_context' &&
            c.name !== 'get_uploaded_content_pack'
        )
      ) {
        app.pushEditHistory();
      }
      const silentPush = { ...bridge, pushUndoSnapshot: () => undefined };

      for (const call of toolCalls) {
        if (!call?.name) continue;

        // Content pack apply uses the shared importer (center progress + cancel).
        if (call.name === 'apply_content_pack') {
          let args: { mode?: string; types?: import('@/lib/ai/content-pack').ContentPackPuzzleKind[] } =
            {};
          try {
            args = JSON.parse(call.arguments || '{}') as typeof args;
          } catch {
            args = {};
          }
          const mode =
            args.mode === 'active' || args.mode === 'matching' || args.mode === 'rebuild'
              ? args.mode
              : 'active';
          const applied = await applyUploadedContentPack(mode, args.types);
          results.push({
            toolCallId: call.id || `tool-${results.length}`,
            name: call.name,
            risk: 'high' as const,
            ok: applied.ok,
            message: applied.message,
          });
          if (applied.ok) toast.success(applied.message);
          else if (applied.message !== 'Cancelled.') toast.error(applied.message);
          await yieldToUi();
          continue;
        }

        const result = await executeAgentToolCall(
          {
            id: call.id || `tool-${results.length}`,
            name: call.name,
            arguments: typeof call.arguments === 'string' ? call.arguments : '{}',
          },
          silentPush
        );
        results.push(result);
        if (result.requiresConfirmation) {
          if (result.name === 'build_book_structure' || result.name === 'regenerate_puzzles') {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
            } catch {
              args = {};
            }
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            appBusy.showBusy('Working…', 10, {
              onCancel: () => {
                controller.abort();
                appBusy.updateBusy({ label: 'Cancelling…' });
              },
            });
            try {
              const confirmed = await executeAgentToolCall(
                {
                  id: `${call.id}-confirmed`,
                  name: result.name,
                  arguments: JSON.stringify({ ...args, confirmed: true }),
                },
                silentPush
              );
              results[results.length - 1] = confirmed;
              if (confirmed.ok) toast.success(confirmed.message);
              else toast.error(confirmed.message);
            } finally {
              appBusy.hideBusy();
              if (abortRef.current === controller) abortRef.current = null;
            }
          } else {
            toast.message(result.message);
          }
        } else if (!result.ok) {
          toast.error(result.message);
        } else if (result.risk !== 'low') {
          toast.success(result.message);
        }
        // Yield so React can paint sidebar/canvas updates between tool calls.
        await yieldToUi();
      }
      return results;
    },
    [app, appBusy, applyUploadedContentPack, bridge]
  );

  const interpretCtx = useCallback(
    () => ({
      platform: platformSourceRef.current,
      documentPages: app.documentPages,
    }),
    [app.documentPages]
  );

  const READ_ONLY_TOOLS = useMemo(
    () =>
      new Set([
        'get_platform_settings',
        'get_project_context',
        'get_selected_elements',
        'get_uploaded_content_pack',
      ]),
    []
  );

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setRows((prev) => [...prev, { role: 'user', content: message }]);
    setBusy(true);
    try {
      // 0) Answer a pending clarifying question first.
      if (pendingClarification) {
        const resolved = resolveCopilotClarification(
          message,
          pendingClarification,
          interpretCtx()
        );
        if (resolved) {
          setPendingClarification(null);
          if (resolved.clarification) {
            setPendingClarification(resolved.clarification);
            setRows((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: [resolved.clarification!.summary, resolved.clarification!.question]
                  .filter(Boolean)
                  .join('\n\n'),
              },
            ]);
            return;
          }
          if (resolved.toolCalls.length === 0) {
            setRows((prev) => [
              ...prev,
              { role: 'assistant', content: resolved.assistantPreview || '🤔 Try another number.' },
            ]);
            return;
          }
          const results = await runToolCalls(resolved.toolCalls);
          setRows((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: formatShortChatReply(resolved.assistantPreview, results),
            },
          ]);
          return;
        }
        // User changed topic — drop the pending question and continue normally.
        setPendingClarification(null);
      }

      // 1) Local structural interpreter — works even without DeepSeek.
      const local = interpretCopilotCommand(message, interpretCtx());
      if (local?.clarification) {
        setPendingClarification(local.clarification);
        setRows((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: [local.clarification!.summary, local.clarification!.question]
              .filter(Boolean)
              .join('\n\n'),
          },
        ]);
        return;
      }
      if (local && local.toolCalls.length === 0 && local.assistantPreview) {
        setRows((prev) => [...prev, { role: 'assistant', content: local.assistantPreview }]);
        return;
      }
      if (local && local.toolCalls.length > 0) {
        const results = await runToolCalls(local.toolCalls);
        const ask = results
          .map((r) => clarificationFromRemoveCandidates(r.message, r.data))
          .find(Boolean);
        if (ask) {
          setPendingClarification(ask);
          setRows((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: [ask.summary, ask.question].filter(Boolean).join('\n\n'),
            },
          ]);
          return;
        }
        setRows((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: formatShortChatReply(local.assistantPreview, results),
          },
        ]);
        return;
      }

      // 2) DeepSeek tool-calling for free-form edits (with follow-up if it only reads).
      const history = rows
        .filter((r) => r.role === 'user' || r.role === 'assistant')
        .slice(-8)
        .map((r) => ({ role: r.role, content: r.content }));

      const callAgent = async (userMessage: string, hist: Array<{ role: string; content: string }>) => {
        const pack = contentPackRef.current;
        const response = await fetch('/api/ai/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            history: hist,
            projectContext: {
              ...bridge.getProjectContext(),
              uploadedContentPack: pack ? contentPackForAiContext(pack) : undefined,
            },
            selectedElements: bridge.getSelectedElements(),
          }),
        });
        const json = (await response.json()) as {
          ok?: boolean;
          content?: string;
          error?: string;
          toolCalls?: AgentToolCallPayload[];
        };
        return { response, json };
      };

      let { response, json } = await callAgent(message, history);
      if (!response.ok || !json.ok) {
        // 3) Soft fallback: try local again after API failure (e.g. missing key).
        const retryLocal = interpretCopilotCommand(message, interpretCtx());
        if (retryLocal?.clarification) {
          setPendingClarification(retryLocal.clarification);
          setRows((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: [retryLocal.clarification!.summary, retryLocal.clarification!.question]
                .filter(Boolean)
                .join('\n\n'),
            },
          ]);
          return;
        }
        if (retryLocal?.toolCalls.length) {
          const results = await runToolCalls(retryLocal.toolCalls);
          setRows((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: formatShortChatReply(retryLocal.assistantPreview, results),
            },
          ]);
          return;
        }
        toast.error(json.error || 'AI assistant failed.');
        setRows((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${json.error || 'Couldn’t finish that.'}` },
        ]);
        return;
      }

      let toolCalls = Array.isArray(json.toolCalls) ? json.toolCalls : [];
      let assistantContent = json.content?.trim() || '';
      const allResults: Awaited<ReturnType<typeof runToolCalls>> = [];

      for (let round = 0; round < 3; round++) {
        if (toolCalls.length === 0) break;
        const results = await runToolCalls(toolCalls);
        allResults.push(...results);

        const onlyReads =
          toolCalls.length > 0 &&
          toolCalls.every((t) => t?.name && READ_ONLY_TOOLS.has(t.name));
        const hasMutation = toolCalls.some((t) => t?.name && !READ_ONLY_TOOLS.has(t.name));
        if (hasMutation || !onlyReads) break;

        // Model only inspected settings — force an apply round with the values it just saw.
        const followHist = [
          ...history,
          { role: 'user', content: message },
          {
            role: 'assistant',
            content:
              assistantContent ||
              'I loaded platform settings but have not applied a change yet.',
          },
          {
            role: 'user',
            content:
              `Tool results from get_platform_settings:\n${JSON.stringify(
                results.map((r) => ({ ok: r.ok, message: r.message, data: r.data })),
                null,
                2
              )}\n\nIMPORTANT: Now APPLY my original request using update_platform_setting (and regenerate if needed). Do not only call get_platform_settings again. Original request: ${message}`,
          },
        ];
        const follow = await callAgent(
          `Apply the change now for: ${message}`,
          followHist
        );
        if (!follow.response.ok || !follow.json.ok) break;
        assistantContent = [assistantContent, follow.json.content?.trim()]
          .filter(Boolean)
          .join('\n');
        toolCalls = Array.isArray(follow.json.toolCalls) ? follow.json.toolCalls : [];
        if (toolCalls.length === 0) break;
      }

      if (allResults.length === 0 && !assistantContent) {
        setRows((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Hmm 🤔 try something like:\n• Grid letters **20pt**\n• Remove **tab 3**',
          },
        ]);
        return;
      }

      const ask = allResults
        .map((r) => clarificationFromRemoveCandidates(r.message, r.data))
        .find(Boolean);
      if (ask) {
        setPendingClarification(ask);
        setRows((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: [ask.summary, ask.question].filter(Boolean).join('\n\n'),
          },
        ]);
        return;
      }

      setRows((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: formatShortChatReply(assistantContent, allResults),
        },
      ]);
    } catch {
      const retryLocal = interpretCopilotCommand(message, interpretCtx());
      if (retryLocal?.clarification) {
        setPendingClarification(retryLocal.clarification);
        setRows((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: [retryLocal.clarification!.summary, retryLocal.clarification!.question]
              .filter(Boolean)
              .join('\n\n'),
          },
        ]);
        return;
      }
      if (retryLocal?.toolCalls.length) {
        try {
          const results = await runToolCalls(retryLocal.toolCalls);
          setRows((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: formatShortChatReply(retryLocal.assistantPreview, results),
            },
          ]);
          return;
        } catch {
          // fall through
        }
      }
      toast.error('AI assistant could not reach the server.');
      setRows((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Network glitch — try again?' },
      ]);
    } finally {
      setBusy(false);
    }
  }, [
    READ_ONLY_TOOLS,
    bridge,
    busy,
    input,
    interpretCtx,
    pendingClarification,
    rows,
    runToolCalls,
  ]);

  if (!open) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[210] flex h-[min(560px,75vh)] w-[min(400px,94vw)] flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl dark:border-violet-900 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
          <Sparkles className="h-4 w-4" />
          GenPuzzle AI
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-500 hover:bg-white/70"
          onClick={onClose}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] text-slate-500 dark:border-slate-800">
        Generators: {availablePuzzleTypes.map((t) => t.label).join(' · ')}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
        {rows.map((row, i) => (
          <div
            key={`${row.role}-${i}`}
            className={
              row.role === 'user'
                ? 'ml-6 rounded-xl bg-violet-600 px-3 py-2 text-white'
                : 'mr-4 rounded-xl bg-slate-100 px-3 py-2 text-slate-800 dark:bg-slate-900 dark:text-slate-100'
            }
          >
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{row.content}</pre>
          </div>
        ))}
        {selectedElements.length > 0 ? (
          <p className="text-[11px] text-slate-500">
            Using {selectedElements.length} selected element
            {selectedElements.length === 1 ? '' : 's'} as context.
          </p>
        ) : null}
        {busy ? (
          <p className="flex items-center gap-2 text-[11px] text-violet-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Working…
          </p>
        ) : null}
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pendingClarification
              ? 'Reply with a tab number…'
              : 'e.g. remove tab 6 · grid letters 20pt'
          }
          className="min-h-[72px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button type="button" size="sm" disabled={busy || !input.trim()} onClick={() => void send()}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Send
          </Button>
        </div>
      </div>
    </aside>
  );
}

/** Build selected page-variable context for the active document. */
export function selectedPageVariablesAsAgentElements(
  pageVariables: unknown,
  selectedIds: string[]
): AgentSelectedElement[] {
  if (!selectedIds.length) return [];
  const fields = normalizePageVariables(pageVariables);
  const idSet = new Set(selectedIds);
  return fields
    .filter((f) => idSet.has(f.id))
    .map((f) => ({
      id: f.id,
      type: 'text',
      kind: f.kind,
      role: f.variableKey || f.kind,
      fontSize: f.fontSize,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      variableKey: f.variableKey,
      text: f.textLines?.[0],
    }));
}
