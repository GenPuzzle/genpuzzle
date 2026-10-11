'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Paperclip, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useApp } from '@/lib/app-context';
import type { PuzzleModuleType } from '@/lib/document-model';
import { AI_SUPPORTED_PUZZLE_TYPES, defaultAiFrontMatter } from '@/lib/ai/types';
import type {
  AiAudience,
  AiDifficultyStrategy,
  AiFrontMatterOptions,
  AiGenerationProgress,
  AiProjectSetup,
  AiPuzzleTypeConfig,
} from '@/lib/ai/types';
import {
  getAiPuzzleTypeLabel,
  parseAiChapterTopics,
  parseAiThemeTitles,
  supportsAiThemeTitles,
  clampAiMurdokuGridSize,
  clampAiMurdokuCharacterCount,
} from '@/lib/ai/types';
import { defaultAiTypeConfig, validateAiSetup } from '@/lib/ai/setup-helpers';
import { isAbortError, runAiBookGeneration } from '@/lib/ai/run-ai-generation';
import { buildAiGeneratedBundle, aiBundleToProjectFile } from '@/lib/ai/build-ai-project';
import {
  aiProjectSpecToSetup,
  type AiProjectPlanSummary,
  type AiProjectSpec,
} from '@/lib/ai/project-spec';
import {
  contentPackForAiContext,
  formatContentPackSummary,
  parseContentPackFile,
  type ContentPack,
} from '@/lib/ai/content-pack';
import {
  isAbortError as isPackAbortError,
  runContentPackImport,
  type ContentPackAppActions,
} from '@/lib/ai/run-content-pack-import';
import { useOptionalAppBusy } from '@/lib/app-busy-context';

export type AiWizardMode = 'project' | 'append' | 'current-document';

interface AiProjectWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  mode?: AiWizardMode;
  insertPosition?: { side: 'before' | 'after'; referenceId: string };
  lockedType?: PuzzleModuleType;
  lockedCount?: number;
  defaultTitle?: string;
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Arabic'];

export function AiProjectWizard({
  open,
  onClose,
  onComplete,
  mode = 'project',
  insertPosition,
  lockedType,
  lockedCount,
  defaultTitle = '',
}: AiProjectWizardProps) {
  const app = useApp();
  const appBusy = useOptionalAppBusy();
  const [step, setStep] = useState(0);
  const [bookTitle, setBookTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('English');
  const [audience, setAudience] = useState<AiAudience>('adults');
  const [customAudience, setCustomAudience] = useState('');
  const [frontMatter, setFrontMatter] = useState<AiFrontMatterOptions>(() => defaultAiFrontMatter());
  const [selected, setSelected] = useState<Partial<Record<PuzzleModuleType, AiPuzzleTypeConfig>>>(
    {}
  );
  const [mixedPerChapter, setMixedPerChapter] = useState(false);
  const [chapterTopicsText, setChapterTopicsText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<AiGenerationProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** project mode: natural-language first, then optional form edit */
  const [nlPhase, setNlPhase] = useState<'prompt' | 'plan' | 'form'>('prompt');
  const [nlPrompt, setNlPrompt] = useState('');
  const [nlPlanning, setNlPlanning] = useState(false);
  const [nlSummary, setNlSummary] = useState<AiProjectPlanSummary | null>(null);
  const [nlSpec, setNlSpec] = useState<AiProjectSpec | null>(null);
  const [contentPack, setContentPack] = useState<ContentPack | null>(null);
  const [contentPackNote, setContentPackNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedList = useMemo(
    () => AI_SUPPORTED_PUZZLE_TYPES.map((t) => selected[t]).filter(Boolean) as AiPuzzleTypeConfig[],
    [selected]
  );
  const chapterTopics = useMemo(
    () => parseAiChapterTopics(chapterTopicsText),
    [chapterTopicsText]
  );
  const chapterCount = mixedPerChapter ? Math.max(1, chapterTopics.length) : 1;

  const isCurrentDoc = mode === 'current-document';
  const lastStep = isCurrentDoc ? 1 : 2;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setGenerating(false);
    setProgress(null);
    abortRef.current?.abort();
    abortRef.current = null;
    setBookTitle(defaultTitle || '');
    setSubtitle('');
    setDescription('');
    setFrontMatter(defaultAiFrontMatter());
    setMixedPerChapter(false);
    setChapterTopicsText('');
    setNlPhase(mode === 'project' ? 'prompt' : 'form');
    setNlPrompt('');
    setNlPlanning(false);
    setNlSummary(null);
    setNlSpec(null);
    setContentPack(null);
    setContentPackNote('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (mode === 'current-document' && lockedType) {
      const cfg = defaultAiTypeConfig(lockedType);
      if (typeof lockedCount === 'number' && lockedCount > 0) {
        cfg.count = Math.max(1, Math.min(200, lockedCount));
      }
      setSelected({ [lockedType]: cfg });
    } else {
      setSelected({});
    }
  }, [open, mode, lockedType, lockedCount, defaultTitle]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  const toggleType = (type: PuzzleModuleType, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[type] = defaultAiTypeConfig(type);
      else delete next[type];
      return next;
    });
  };

  const patchType = (type: PuzzleModuleType, patch: Partial<AiPuzzleTypeConfig>) => {
    setSelected((prev) => {
      const current = prev[type] ?? defaultAiTypeConfig(type);
      return { ...prev, [type]: { ...current, ...patch, type } };
    });
  };

  const patchFrontMatter = (patch: Partial<AiFrontMatterOptions>) => {
    setFrontMatter((prev) => ({ ...prev, ...patch }));
  };

  const buildSetup = (): AiProjectSetup => ({
    bookTitle: bookTitle.trim(),
    subtitle: subtitle.trim(),
    description: description.trim(),
    language,
    audience,
    customAudience: customAudience.trim(),
    puzzleTypes: selectedList,
    frontMatter: isCurrentDoc ? defaultAiFrontMatter() : frontMatter,
    organization: !isCurrentDoc && mixedPerChapter ? 'by-chapter' : 'by-type',
    chapterTopics: !isCurrentDoc && mixedPerChapter ? chapterTopicsText : undefined,
    solutionsPerPage: nlSpec?.solutions.perPage,
    minimumFontSize: nlSpec?.typography.minimumFontSize,
    funFactsPosition: nlSpec?.funFacts.position,
    ensureFunFactPageVariable: nlSpec?.funFacts.enabled === true,
    startPuzzleNumber: nlSpec?.startPuzzleNumber,
  });

  const applySpecToForm = (spec: AiProjectSpec) => {
    const setup = aiProjectSpecToSetup(spec);
    setBookTitle(setup.bookTitle);
    setSubtitle(setup.subtitle);
    setDescription(setup.description);
    setLanguage(setup.language || 'English');
    setAudience(setup.audience || 'adults');
    setFrontMatter(setup.frontMatter || defaultAiFrontMatter());
    setMixedPerChapter(setup.organization === 'by-chapter');
    setChapterTopicsText(setup.chapterTopics || '');
    const next: Partial<Record<PuzzleModuleType, AiPuzzleTypeConfig>> = {};
    for (const cfg of setup.puzzleTypes) {
      next[cfg.type] = cfg;
    }
    setSelected(next);
    setNlSpec(spec);
  };

  const handlePlanFromPrompt = async () => {
    const prompt = nlPrompt.trim();
    if (!prompt && !contentPack) {
      toast.error('Describe the puzzle book you want to create, or upload a content file.');
      return;
    }
    setNlPlanning(true);
    try {
      const response = await fetch('/api/ai/plan-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:
            prompt ||
            `Build a puzzle book from the uploaded content pack “${contentPack?.sourceName || 'file'}”.`,
          uploadedContentPack: contentPack ? contentPackForAiContext(contentPack) : undefined,
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        spec?: AiProjectSpec;
        summary?: AiProjectPlanSummary;
      };
      if (!response.ok || !json.ok || !json.spec || !json.summary) {
        toast.error(json.error || 'Could not understand that request.');
        return;
      }
      setNlSpec(json.spec);
      setNlSummary(json.summary);
      applySpecToForm(json.spec);
      setNlPhase('plan');
    } catch {
      toast.error('Could not reach the AI planner.');
    } finally {
      setNlPlanning(false);
    }
  };

  const handleUploadContentPack = async (file: File | null | undefined) => {
    if (!file || generating || nlPlanning) return;
    const lower = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv|txt)$/.test(lower)) {
      toast.error('Please upload a .xlsx, .xls, .csv, or .txt file.');
      return;
    }
    setNlPlanning(true);
    try {
      const pack = await parseContentPackFile(file);
      setContentPack(pack);
      setContentPackNote(formatContentPackSummary(pack).split('\n\nHow should')[0] || file.name);
      if (!bookTitle.trim()) {
        setBookTitle(file.name.replace(/\.[^.]+$/, ''));
      }
      toast.success(`Loaded ${file.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that file.');
    } finally {
      setNlPlanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const contentPackAppActions = (): ContentPackAppActions => ({
    getDocumentPages: () => app.documentPages,
    replaceDocumentPages: (pages, activeId) => app.replaceDocumentPages(pages, activeId),
    setBookSettings: (patch) => app.setBookSettings({ ...app.bookSettings, ...patch }),
    getBookSettings: () => ({ ...app.bookSettings }),
    setProjectName: (name) => app.setProjectName(name),
    setTitleWords: (next) => app.setTitleWords(next),
    setActiveDocumentPageId: (id) => app.setActiveDocumentPageId(id),
    setCrosswordSettings: (settings) => app.setCrosswordSettings(settings),
    setGenericPuzzleSettings: (settings) => app.setGenericPuzzleSettings(settings),
    updateWordSearchSettings: (patch, options) =>
      app.updateWordSearchSettings(patch, { recordHistory: options?.recordHistory ?? false }),
    regenerateWordSearchDocuments: (pages) => app.regenerateWordSearchDocuments(pages),
    generatePuzzle: (options) => app.generatePuzzle(options),
    pushEditHistory: () => app.pushEditHistory(),
  });

  const handleBuildFromContentPack = async () => {
    if (!contentPack) {
      toast.error('Upload a TXT / Excel content file first.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setProgress({
      overallDone: 0,
      overallTotal: 100,
      byType: {},
      statusMessage: 'Copying words, clues & fun facts into settings…',
    });
    appBusy.showBusy('Copying words, clues & fun facts…', 2, {
      onCancel: () => {
        controller.abort();
        appBusy.updateBusy({ label: 'Cancelling…' });
      },
    });
    try {
      const result = await runContentPackImport({
        pack: contentPack,
        mode: 'rebuild',
        app: contentPackAppActions(),
        bookTitle: bookTitle.trim() || contentPack.sourceName.replace(/\.[^.]+$/, ''),
        signal: controller.signal,
        onProgress: (statusMessage, progressPct) => {
          setProgress({
            overallDone: progressPct ?? 0,
            overallTotal: 100,
            byType: {},
            statusMessage,
          });
          appBusy.updateBusy({
            label: statusMessage,
            progress: progressPct,
            onCancel: () => {
              controller.abort();
              appBusy.updateBusy({ label: 'Cancelling…' });
            },
          });
        },
        generate: true,
      });
      if (controller.signal.aborted) return;
      if (!result.ok) {
        toast.error(result.error || result.message);
        return;
      }
      toast.success('Book built from your file. Review and edit before exporting.');
      onComplete();
      onClose();
    } catch (err) {
      if (isAbortError(err) || isPackAbortError(err) || controller.signal.aborted) return;
      toast.error('Could not build the book from that file.');
    } finally {
      appBusy.hideBusy();
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setGenerating(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    appBusy.hideBusy();
    onClose();
  };

  const handleGenerate = async () => {
    const setup = buildSetup();
    const error = validateAiSetup(setup);
    if (error) {
      toast.error(error);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setProgress(null);
    appBusy.showBusy('Generating your book…', 4, {
      onCancel: () => {
        controller.abort();
        appBusy.updateBusy({ label: 'Cancelling…' });
      },
    });
    try {
      const result = await runAiBookGeneration(
        setup,
        (next) => {
          setProgress(next);
          const pct =
            next.overallTotal > 0
              ? Math.round((next.overallDone / next.overallTotal) * 100)
              : undefined;
          appBusy.updateBusy({
            label: next.statusMessage || 'Generating…',
            progress: pct,
            onCancel: () => {
              controller.abort();
              appBusy.updateBusy({ label: 'Cancelling…' });
            },
          });
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const progressOpts = {
        signal: controller.signal,
        onProgress: (statusMessage: string) =>
          setProgress((prev) =>
            prev ? { ...prev, statusMessage } : { overallDone: 0, overallTotal: 0, byType: {}, statusMessage }
          ),
      };
      const bundle = await buildAiGeneratedBundle(
        setup,
        result.contentByType,
        result.frontMatterCopy,
        progressOpts
      );
      if (controller.signal.aborted) return;
      if (mode === 'append') {
        app.appendAiGeneratedBundle(bundle, insertPosition);
        if (setup.organization === 'by-chapter') {
          app.setBookSettings({
            ...app.bookSettings,
            mixPuzzles: true,
            chapterTopics: parseAiChapterTopics(setup.chapterTopics),
          });
        }
        toast.success('AI documents added. Review and edit before exporting.');
      } else if (mode === 'current-document') {
        app.applyAiGeneratedToActiveDocument(bundle);
        toast.success('AI content generated for this document. You can still edit everything.');
      } else {
        const project = aiBundleToProjectFile(setup, bundle);
        app.loadProjectSnapshot(project);
        toast.success(
          'AI content generated successfully. Review and edit your puzzles before generating the final book.'
        );
      }
      onComplete();
      onClose();
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return;
      toast.error('AI generation could not be completed. Please try again.');
    } finally {
      appBusy.hideBusy();
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setGenerating(false);
    }
  };

  const overallPct = progress
    ? Math.round((progress.overallDone / Math.max(1, progress.overallTotal)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {mode === 'current-document'
                  ? 'Generate with AI'
                  : mode === 'append'
                    ? 'Add documents with AI'
                    : 'Create Puzzles with AI'}
              </h2>
              <p className="text-xs text-slate-500">
                Step {Math.min(step + 1, lastStep + 1)} of {lastStep + 1} · Content stays fully
                editable
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {generating ? (
            <div className="space-y-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {mode === 'current-document'
                    ? 'Generating this document…'
                    : mode === 'append'
                      ? 'Generating documents…'
                      : 'Generating your book…'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {progress?.statusMessage || 'Contacting AI…'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Overall</span>
                  <span>
                    {progress?.overallDone ?? 0} / {progress?.overallTotal ?? 0} puzzles
                  </span>
                </div>
                <Progress value={overallPct} className="h-2" />
              </div>
              <div className="space-y-3">
                {Object.entries(progress?.byType ?? {}).map(([key, row]) => {
                  const pct = Math.round((row.done / Math.max(1, row.total)) * 100);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>{row.label}</span>
                        <span>
                          {row.done} / {row.total}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          ) : mode === 'project' && nlPhase === 'prompt' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Describe your puzzle book</h3>
                <p className="mt-1 text-sm text-slate-500">
                  GenPuzzle will interpret your request into chapters, puzzle types, and settings —
                  then show a plan before generating. Or upload a TXT / Excel word list / content
                  pack and build the book from that file.
                </p>
              </div>
              <Textarea
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                placeholder='Example: Make a sea puzzle book with 6 chapters. Add Word Search, Crossword and Mazes to every chapter. Create 10 puzzles of each type per chapter. Use 4 solutions per page. Make sure all fonts are at least 18pt. Add a unique fun fact under the title on every puzzle page.'
                className="min-h-[140px] text-sm"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                className="hidden"
                onChange={(e) => void handleUploadContentPack(e.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={nlPlanning || generating}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Upload TXT / Excel
                </Button>
                {contentPack ? (
                  <span className="text-xs text-violet-700">
                    Loaded: {contentPack.sourceName}
                  </span>
                ) : null}
              </div>
              {contentPackNote ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
                  {contentPackNote}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handlePlanFromPrompt()}
                  disabled={nlPlanning || (!nlPrompt.trim() && !contentPack)}
                >
                  {nlPlanning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Create plan
                </Button>
                {contentPack ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={nlPlanning || generating}
                    onClick={() => void handleBuildFromContentPack()}
                  >
                    Build book from file
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setNlPhase('form')}>
                  Use form instead
                </Button>
              </div>
            </div>
          ) : mode === 'project' && nlPhase === 'plan' && nlSummary ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">AI understood your request</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Review the plan. Nothing is generated until you confirm.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 space-y-2">
                <p>
                  <span className="font-semibold">Theme:</span> {nlSummary.theme}
                </p>
                <p>
                  <span className="font-semibold">Book title:</span> {nlSummary.bookTitle}
                </p>
                <p>
                  <span className="font-semibold">Chapters:</span> {nlSummary.chapters}
                  {nlSummary.chapterTitles.length
                    ? ` — ${nlSummary.chapterTitles.join(', ')}`
                    : ''}
                </p>
                <div>
                  <p className="font-semibold">Puzzle types:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {nlSummary.puzzleTypes.map((pt) => (
                      <li key={pt.type}>
                        {pt.label} — {pt.countPerChapter}/chapter ({pt.total} total)
                      </li>
                    ))}
                  </ul>
                </div>
                <p>
                  <span className="font-semibold">Total puzzles:</span> {nlSummary.totalPuzzles}
                </p>
                <p>
                  <span className="font-semibold">Solutions:</span> {nlSummary.solutionsPerPage} per
                  page
                </p>
                <p>
                  <span className="font-semibold">Minimum font:</span>{' '}
                  {nlSummary.minimumFontSize}pt
                </p>
                <p>
                  <span className="font-semibold">Fun facts:</span>{' '}
                  {nlSummary.funFacts.enabled
                    ? `Yes (${nlSummary.funFacts.position.replace(/_/g, ' ')})`
                    : 'No'}
                </p>
                {nlSummary.warnings.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-amber-700">
                    {nlSummary.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (nlSpec) applySpecToForm(nlSpec);
                    void handleGenerate();
                  }}
                >
                  Create Project
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (nlSpec) applySpecToForm(nlSpec);
                    setNlPhase('form');
                    setStep(0);
                  }}
                >
                  Edit Plan
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNlPhase('prompt')}>
                  Back
                </Button>
              </div>
            </div>
          ) : step === 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Book information
              </h3>
              <div className="space-y-1.5">
                <Label>Book Title</Label>
                <Input
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="e.g. Ocean Adventures Puzzle Book"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subtitle</Label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Optional subtitle"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Book / topic description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Themes, topics, tone…"
                  rows={4}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Target audience</Label>
                  <Select
                    value={audience}
                    onValueChange={(v) => setAudience(v as AiAudience)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kids">Kids</SelectItem>
                      <SelectItem value="teens">Teens</SelectItem>
                      <SelectItem value="adults">Adults</SelectItem>
                      <SelectItem value="seniors">Seniors</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {audience === 'custom' ? (
                <div className="space-y-1.5">
                  <Label>Custom audience</Label>
                  <Input
                    value={customAudience}
                    onChange={(e) => setCustomAudience(e.target.value)}
                    placeholder="Describe your audience"
                  />
                </div>
              ) : null}
              {!isCurrentDoc ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Book pages</h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Optional pages added in front of your puzzles. Introduction and instructions
                      are written by AI from this book information.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['includeTitlePage', 'Title page'],
                        ['includeTableOfContents', 'Table of contents'],
                        ['includeIntroduction', 'Introduction'],
                        ['includeInstructions', 'Instructions'],
                        ['includeChapterPages', 'Chapter pages'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-start gap-2.5">
                        <Checkbox
                          checked={frontMatter[key]}
                          onCheckedChange={(v) =>
                            patchFrontMatter({
                              [key]: v === true,
                              ...(key === 'includeChapterPages' && v !== true
                                ? { useCustomChapterTitles: false }
                                : {}),
                            })
                          }
                        />
                        <span className="text-sm text-slate-800">{label}</span>
                      </label>
                    ))}
                  </div>
                  {frontMatter.includeChapterPages ? (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      {mixedPerChapter ? (
                        <p className="text-xs text-slate-500">
                          Chapter pages use your chapter topics. Turn on Mix the puzzles in Book
                          Settings or Download to place each chapter page before that chapter&apos;s
                          mixed puzzles.
                        </p>
                      ) : (
                        <>
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <Checkbox
                              checked={frontMatter.useCustomChapterTitles}
                              onCheckedChange={(v) =>
                                patchFrontMatter({ useCustomChapterTitles: v === true })
                              }
                            />
                            <span className="text-sm text-slate-800">Enter chapter titles</span>
                          </label>
                          {frontMatter.useCustomChapterTitles ? (
                            <div className="space-y-1.5">
                              <Textarea
                                value={frontMatter.chapterTitles}
                                onChange={(e) =>
                                  patchFrontMatter({ chapterTitles: e.target.value })
                                }
                                placeholder={'Ocean Adventures\nCrossword Harbor\nMaze Island'}
                                rows={4}
                              />
                              <p className="text-xs text-slate-500">
                                One title per line. Titles are placed before each puzzle type in
                                order. Extra titles are added at the end.
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              One chapter page is added before each puzzle type, using that
                              type&apos;s name (Word Search, Crossword, and so on).
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : !isCurrentDoc && step === 1 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Select puzzle types
              </h3>
              <p className="text-sm text-slate-500">
                Only puzzle types already supported by GenPuzzle are listed.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {AI_SUPPORTED_PUZZLE_TYPES.map((type) => {
                  const checked = Boolean(selected[type]);
                  return (
                    <label
                      key={type}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        checked
                          ? 'border-violet-400 bg-violet-50/60'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleType(type, v === true)}
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {getAiPuzzleTypeLabel(type)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          AI fills the same fields you edit manually
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={mixedPerChapter}
                    onCheckedChange={(v) => setMixedPerChapter(v === true)}
                  />
                  <span>
                    <span className="text-sm font-semibold text-slate-900">
                      Mixed puzzles for each chapter
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Enter a topic per chapter. Then choose how many of each puzzle type to generate
                      for every chapter. Word search #1–N, crossword #1–N, and so on all follow that
                      chapter&apos;s topic.
                    </span>
                  </span>
                </label>
                {mixedPerChapter ? (
                  <div className="space-y-1.5">
                    <Label>Chapter topics (one per line)</Label>
                    <Textarea
                      value={chapterTopicsText}
                      onChange={(e) => setChapterTopicsText(e.target.value)}
                      placeholder={'Ocean animals\nSpace travel\nRainforest birds'}
                      rows={5}
                    />
                    <p className="text-xs text-slate-500">
                      {chapterTopics.length === 0
                        ? 'Enter at least one chapter topic.'
                        : `${chapterTopics.length} chapter${chapterTopics.length === 1 ? '' : 's'}. Next, set how many puzzles of each type per chapter.`}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Puzzle options
              </h3>
              {mixedPerChapter ? (
                <p className="text-sm text-slate-500">
                  Counts are per chapter. If you choose 6 of each type, word search #1–6, crossword
                  #1–6, scramble #1–6, and so on all follow chapter 1&apos;s topic, then the same
                  for chapter 2.
                </p>
              ) : null}
              {selectedList.length === 0 ? (
                <p className="text-sm text-slate-500">Go back and select at least one puzzle type.</p>
              ) : (
                selectedList.map((cfg) => (
                  <div
                    key={cfg.type}
                    className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <h4 className="text-sm font-semibold text-slate-900">
                      {getAiPuzzleTypeLabel(cfg.type)}
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>
                          {mixedPerChapter
                            ? `${getAiPuzzleTypeLabel(cfg.type)} per chapter`
                            : 'Number of puzzles'}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={200}
                          value={cfg.count}
                          onChange={(e) =>
                            patchType(cfg.type, {
                              count: Math.max(1, Math.min(200, Number(e.target.value) || 1)),
                            })
                          }
                        />
                        {mixedPerChapter ? (
                          <p className="text-xs text-slate-500">
                            {chapterCount} chapter{chapterCount === 1 ? '' : 's'} × {cfg.count} ={' '}
                            {chapterCount * cfg.count} {getAiPuzzleTypeLabel(cfg.type).toLowerCase()}
                          </p>
                        ) : null}
                      </div>
                      {(cfg.type === 'word-search' || cfg.type === 'word-scramble') && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Words per puzzle</Label>
                            <Input
                              type="number"
                              min={0}
                              max={40}
                              value={cfg.wordsPerPuzzle ?? 15}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  wordsPerPuzzle: Math.max(
                                    3,
                                    Math.min(40, Number(e.target.value) || 10)
                                  ),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Max word length</Label>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={cfg.maxWordLength ?? 12}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  maxWordLength: Math.max(
                                    3,
                                    Math.min(20, Number(e.target.value) || 12)
                                  ),
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                      {cfg.type === 'crossword' && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Clues per puzzle</Label>
                            <Input
                              type="number"
                              min={0}
                              max={40}
                              value={cfg.cluesPerPuzzle ?? 15}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  cluesPerPuzzle: Math.max(
                                    4,
                                    Math.min(40, Number(e.target.value) || 15)
                                  ),
                                })
                              }
                            />
                          </div>
                          <label className="flex items-start gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={cfg.exactClueCount === true}
                              onCheckedChange={(c) =>
                                patchType(cfg.type, { exactClueCount: c === true })
                              }
                              className="mt-0.5"
                            />
                            <span>
                              Make exactly {cfg.cluesPerPuzzle ?? 15} clues
                              <span className="block text-xs text-muted-foreground">
                                This could take time
                              </span>
                            </span>
                          </label>
                          <div className="space-y-1.5">
                            <Label>Max answer length</Label>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={cfg.maxAnswerLength ?? 15}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  maxAnswerLength: Math.max(
                                    3,
                                    Math.min(20, Number(e.target.value) || 15)
                                  ),
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                      {cfg.type === 'sudoku' && (
                        <div className="space-y-1.5">
                          <Label>Grid size</Label>
                          <Select
                            value={String(cfg.sudokuSize ?? 9)}
                            onValueChange={(v) =>
                              patchType(cfg.type, {
                                sudokuSize: Number(v) as 4 | 6 | 9,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="4">4×4</SelectItem>
                              <SelectItem value="6">6×6</SelectItem>
                              <SelectItem value="9">9×9</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {cfg.type === 'trivia' && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Questions per game</Label>
                            <Input
                              type="number"
                              min={0}
                              max={30}
                              value={cfg.questionsPerPuzzle ?? 10}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  questionsPerPuzzle: Math.max(
                                    3,
                                    Math.min(30, Number(e.target.value) || 10)
                                  ),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Suggestions per question</Label>
                            <Input
                              type="number"
                              min={0}
                              max={6}
                              value={cfg.suggestionsPerQuestion ?? 4}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  suggestionsPerQuestion: Math.max(
                                    2,
                                    Math.min(6, Number(e.target.value) || 4)
                                  ),
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                      {cfg.type === 'murdoku' && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Grid rows</Label>
                            <Input
                              type="number"
                              min={4}
                              max={16}
                              value={cfg.murdokuRows ?? 9}
                              onChange={(e) => {
                                const murdokuRows = clampAiMurdokuGridSize(e.target.value);
                                const murdokuCols = clampAiMurdokuGridSize(cfg.murdokuCols ?? 9);
                                patchType(cfg.type, {
                                  murdokuRows,
                                  charactersPerPuzzle: clampAiMurdokuCharacterCount(
                                    cfg.charactersPerPuzzle,
                                    murdokuRows,
                                    murdokuCols
                                  ),
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Grid columns</Label>
                            <Input
                              type="number"
                              min={4}
                              max={16}
                              value={cfg.murdokuCols ?? 9}
                              onChange={(e) => {
                                const murdokuRows = clampAiMurdokuGridSize(cfg.murdokuRows ?? 9);
                                const murdokuCols = clampAiMurdokuGridSize(e.target.value);
                                patchType(cfg.type, {
                                  murdokuCols,
                                  charactersPerPuzzle: clampAiMurdokuCharacterCount(
                                    cfg.charactersPerPuzzle,
                                    murdokuRows,
                                    murdokuCols
                                  ),
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Characters per puzzle</Label>
                            <Input
                              type="number"
                              min={3}
                              max={Math.min(cfg.murdokuRows ?? 9, cfg.murdokuCols ?? 9)}
                              value={cfg.charactersPerPuzzle ?? 9}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  charactersPerPuzzle: clampAiMurdokuCharacterCount(
                                    e.target.value,
                                    clampAiMurdokuGridSize(cfg.murdokuRows ?? 9),
                                    clampAiMurdokuGridSize(cfg.murdokuCols ?? 9)
                                  ),
                                })
                              }
                            />
                            <p className="text-xs text-slate-500">
                              Each person needs a unique row and column, so this cannot exceed{' '}
                              {Math.min(cfg.murdokuRows ?? 9, cfg.murdokuCols ?? 9)}.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <Checkbox
                              checked={cfg.murdokuAvoidRandomProps !== false}
                              onCheckedChange={(v) =>
                                patchType(cfg.type, { murdokuAvoidRandomProps: v === true })
                              }
                            />
                            Avoid random props
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <Checkbox
                              checked={cfg.murdokuLargeFurnitureOnly === true}
                              onCheckedChange={(v) =>
                                patchType(cfg.type, { murdokuLargeFurnitureOnly: v === true })
                              }
                            />
                            Use only large room-related furniture/decor
                          </label>
                        </>
                      )}
                    </div>

                    {cfg.type === 'word-search' ? (
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox
                          checked={Boolean(cfg.generateFunFacts)}
                          onCheckedChange={(v) =>
                            patchType(cfg.type, { generateFunFacts: v === true })
                          }
                        />
                        Generate a fun fact for every puzzle
                      </label>
                    ) : null}

                    {supportsAiThemeTitles(cfg.type) && !mixedPerChapter ? (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={Boolean(cfg.useCustomThemeTitles)}
                            onCheckedChange={(v) =>
                              patchType(cfg.type, { useCustomThemeTitles: v === true })
                            }
                          />
                          Enter theme titles
                        </label>
                        {cfg.useCustomThemeTitles ? (
                          <div className="space-y-1.5">
                            <Label>Theme titles (one per line)</Label>
                            <Textarea
                              value={cfg.themeTitles ?? ''}
                              onChange={(e) =>
                                patchType(cfg.type, { themeTitles: e.target.value })
                              }
                              placeholder={
                                cfg.type === 'murdoku'
                                  ? 'Haunted hotel\nMidnight train\nHarbor warehouse'
                                  : 'Ocean animals\nSpace travel\nRainforest birds'
                              }
                              rows={Math.min(8, Math.max(4, cfg.count))}
                            />
                            <p className="text-xs text-slate-500">
                              {parseAiThemeTitles(cfg.themeTitles).length} of {cfg.count} title
                              {cfg.count === 1 ? '' : 's'} entered.{' '}
                              {cfg.type === 'murdoku'
                                ? 'Each line is the case theme for that puzzle (title and story).'
                                : 'AI will use these as puzzle titles and match the content to each theme.'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Leave unchecked to let AI invent a title for each puzzle.
                          </p>
                        )}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <RadioGroup
                        value={cfg.difficultyStrategy}
                        onValueChange={(v) =>
                          patchType(cfg.type, {
                            difficultyStrategy: v as AiDifficultyStrategy,
                          })
                        }
                        className="grid gap-2 sm:grid-cols-2"
                      >
                        {(
                          [
                            ['easy', 'Easy'],
                            ['medium', 'Medium'],
                            ['hard', 'Hard'],
                            ['easy-to-hard', 'Easy to Hard'],
                            ['custom', 'Custom distribution'],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <RadioGroupItem value={value} />
                            {label}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>

                    {cfg.difficultyStrategy === 'custom' ? (
                      <div className="grid grid-cols-3 gap-2">
                        {(['easy', 'medium', 'hard'] as const).map((key) => (
                          <div key={key} className="space-y-1">
                            <Label className="capitalize">{key}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={cfg.customDistribution?.[key] ?? 0}
                              onChange={(e) =>
                                patchType(cfg.type, {
                                  customDistribution: {
                                    easy: cfg.customDistribution?.easy ?? 0,
                                    medium: cfg.customDistribution?.medium ?? 0,
                                    hard: cfg.customDistribution?.hard ?? 0,
                                    [key]: Math.max(0, Number(e.target.value) || 0),
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {!generating && nlPhase === 'form' ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 0 && mode === 'project') {
                  setNlPhase('prompt');
                  return;
                }
                if (step === 0) {
                  onClose();
                  return;
                }
                setStep((s) => s - 1);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step === 0 ? (mode === 'project' ? 'Back to describe' : 'Cancel') : 'Back'}
            </Button>
            {step < lastStep ? (
              <Button
                onClick={() => {
                  if (step === 0 && !bookTitle.trim()) {
                    toast.error('Please enter a book title.');
                    return;
                  }
                  if (!isCurrentDoc && step === 1 && selectedList.length === 0) {
                    toast.error('Select at least one puzzle type.');
                    return;
                  }
                  if (!isCurrentDoc && step === 1 && mixedPerChapter && chapterTopics.length === 0) {
                    toast.error('Enter at least one chapter topic (one per line).');
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {mode === 'current-document'
                  ? 'Generate with AI'
                  : mode === 'append'
                    ? 'Add with AI'
                    : 'Generate Book Content with AI'}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
