'use client';

/**
 * Document-tab panels for Trivia — Puzzle / Words (Titles reuse GenericPuzzleTitlesPanel).
 */

import React, { useMemo } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { IntegerInput } from '@/components/ui/integer-input';
import { SliderField } from '@/components/ui/slider-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MiniColorInput } from '@/components/ui/color-input';
import { Textarea } from '@/components/ui/textarea';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { DivideListsIntoChaptersControl } from '@/components/DivideListsIntoChaptersControl';

import type {
  GenericPuzzleSettings,
  TriviaCheckboxStyle,
  TriviaLayoutFormat,
  TriviaSolutionColumns,
  TriviaSuggestionsColumns,
} from '@/lib/generic-puzzle-settings';
import { normalizeGenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import {
  computeTriviaSolutionsPerPage,
  getMissingTriviaSuggestions,
  getSubmittedSuggestionsPerQuestion,
  parseTriviaLines,
} from '@/lib/puzzles/trivia';

function useTriviaDoc() {
  const { genericPuzzleSettings, updateGenericPuzzleSettings } = useApp();
  const settings = normalizeGenericPuzzleSettings(genericPuzzleSettings, 'trivia');
  const { core, typography, colors } = settings;

  const patchCore = (patch: Partial<GenericPuzzleSettings['core']>) => {
    updateGenericPuzzleSettings({ core: { ...core, ...patch } });
  };
  const patchTypography = (patch: Partial<GenericPuzzleSettings['typography']>) => {
    updateGenericPuzzleSettings({ typography: { ...typography, ...patch } });
  };
  const patchColors = (patch: Partial<GenericPuzzleSettings['colors']>) => {
    updateGenericPuzzleSettings({ colors: { ...colors, ...patch } });
  };

  const requiredQuestions = Math.max(1, core.numberOfPuzzles);
  const questionsPerPage = Math.max(1, core.questionsPerPage);
  const pageCount = Math.max(1, Math.ceil(requiredQuestions / questionsPerPage));
  const requiredSuggestions =
    requiredQuestions * Math.max(2, core.suggestionsPerQuestion);
  const requiredAnswers = requiredQuestions;

  const questionLines = useMemo(
    () => parseTriviaLines(core.questionsText),
    [core.questionsText]
  );
  const suggestionLines = useMemo(
    () => parseTriviaLines(core.suggestionsText),
    [core.suggestionsText]
  );
  const answerLines = useMemo(
    () => parseTriviaLines(core.answersText),
    [core.answersText]
  );

  const submittedPer = getSubmittedSuggestionsPerQuestion(
    suggestionLines.length,
    requiredQuestions
  );
  const missingSuggestions = getMissingTriviaSuggestions(
    suggestionLines.length,
    requiredQuestions,
    core.suggestionsPerQuestion
  );

  const answersPerColumn = Math.max(1, core.solutionsPerPage || 20);
  const solutionColumns = (core.triviaSolutionColumns || 3) as TriviaSolutionColumns;
  const answersPerPage = computeTriviaSolutionsPerPage({
    answersPerColumn,
    solutionColumns,
  });
  const solutionPageCount = Math.max(
    1,
    Math.ceil(requiredQuestions / answersPerPage)
  );

  return {
    core,
    typography,
    colors,
    patchCore,
    patchTypography,
    patchColors,
    requiredQuestions,
    requiredSuggestions,
    requiredAnswers,
    pageCount,
    questionLines,
    suggestionLines,
    answerLines,
    submittedPer,
    missingSuggestions,
    answersPerColumn,
    solutionColumns,
    answersPerPage,
    solutionPageCount,
  };
}

function PanelHeader({ title, onSave }: { title: string; onSave?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          Document · This tab
        </p>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {onSave && (
        <Button variant="outline" size="sm" onClick={onSave}>
          <Save className="w-4 h-4 mr-2" />Save
        </Button>
      )}
    </div>
  );
}

export function TriviaPuzzleSettingsPanel({ onSave }: { onSave?: () => void }) {
  const {
    core,
    typography,
    colors,
    patchCore,
    patchTypography,
    patchColors,
    requiredQuestions,
    suggestionLines,
    answersPerColumn,
    solutionColumns,
    answersPerPage,
    solutionPageCount,
  } = useTriviaDoc();

  const handleSuggestionsPerChange = (v: number) => {
    const need = getMissingTriviaSuggestions(
      suggestionLines.length,
      requiredQuestions,
      v
    );
    if (need > 0) {
      window.alert(
        `Need ${need} more suggestion${need === 1 ? '' : 's'} for ${requiredQuestions} questions × ${v} suggestions each.`
      );
    }
    patchCore({ suggestionsPerQuestion: v });
  };

  return (
    <div className="space-y-4">
      <PanelHeader title="Puzzle Settings" onSave={onSave} />


      <div className="space-y-3">
        <Label className="text-sm font-medium">Quantity</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Total Number of Questions</Label>
            <IntegerInput
              value={core.numberOfPuzzles}
              onChange={(v) => patchCore({ numberOfPuzzles: v })}
              min={0}
              max={600}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Starting Number</Label>
            <IntegerInput
              value={core.puzzlesStartingNumber}
              onChange={(v) => patchCore({ puzzlesStartingNumber: v })}
              min={0}
              max={9999}
            />
          </div>
        </div>
        <DivideListsIntoChaptersControl
          numberOfPuzzles={core.numberOfPuzzles}
          puzzlesStartingNumber={core.puzzlesStartingNumber}
        />
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Questions Per Page</Label>
          <IntegerInput
            value={core.questionsPerPage}
            onChange={(v) => patchCore({ questionsPerPage: v })}
            min={0}
            max={20}
          />
          <p className="text-[11px] text-gray-500">
            {Math.max(
              1,
              Math.ceil(
                Math.max(1, core.numberOfPuzzles) / Math.max(1, core.questionsPerPage)
              )
            )}{' '}
            page
            {Math.ceil(
              Math.max(1, core.numberOfPuzzles) / Math.max(1, core.questionsPerPage)
            ) === 1
              ? ''
              : 's'}{' '}
            will be created
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Suggestions Per Trivia</Label>
          <IntegerInput
            value={core.suggestionsPerQuestion}
            onChange={handleSuggestionsPerChange}
            min={0}
            max={8}
          />
          <p className="text-[11px] text-gray-500">
            Need {requiredQuestions * core.suggestionsPerQuestion} suggestions total.
            Extra suggestions are dropped when lowering this (answers are kept and
            reshuffled).
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Solution Columns</Label>
          <Select
            value={String(solutionColumns)}
            onValueChange={(value) =>
              patchCore({
                triviaSolutionColumns: parseInt(value, 10) as TriviaSolutionColumns,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 column</SelectItem>
              <SelectItem value="2">2 columns</SelectItem>
              <SelectItem value="3">3 columns</SelectItem>
              <SelectItem value="4">4 columns</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-gray-500">
            Default 3. Side-by-side answer tables on each solution page.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Answers Per column/Page</Label>
          <IntegerInput
            value={answersPerColumn}
            onChange={(v) => patchCore({ solutionsPerPage: v })}
            min={0}
            max={50}
          />
          <p className="text-[11px] text-gray-500">
            Default 20 per column ({answersPerPage} total / page with{' '}
            {solutionColumns} column{solutionColumns === 1 ? '' : 's'}). About{' '}
            {solutionPageCount} solution page{solutionPageCount === 1 ? '' : 's'}.
            Content auto-scales inside the safe margin.
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Layout Format</Label>
        <Select
          value={core.triviaLayoutFormat}
          onValueChange={(value) =>
            patchCore({ triviaLayoutFormat: value as TriviaLayoutFormat })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single-column">Single column (stacked)</SelectItem>
            <SelectItem value="two-column">Two columns</SelectItem>
            <SelectItem value="compact">Compact spacing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Suggestions Layout</Label>
        <Select
          value={core.triviaSuggestionsColumns}
          onValueChange={(value) =>
            patchCore({ triviaSuggestionsColumns: value as TriviaSuggestionsColumns })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single column</SelectItem>
            <SelectItem value="two">2 columns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Answer Checkbox</Label>
        <Select
          value={core.triviaCheckboxStyle}
          onValueChange={(value) =>
            patchCore({ triviaCheckboxStyle: value as TriviaCheckboxStyle })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="square">Square</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Puzzle Page Spacing</Label>
        <SliderField
          label="Space Between Questions"
          value={typography.triviaSpaceBetweenQuestions}
          onValueChange={(v) => patchTypography({ triviaSpaceBetweenQuestions: v })}
          min={0}
          max={48}
          step={1}
          format="pt"
        />
        <SliderField
          label="Space After Question"
          value={typography.triviaSpaceAfterQuestion}
          onValueChange={(v) => patchTypography({ triviaSpaceAfterQuestion: v })}
          min={0}
          max={32}
          step={1}
          format="pt"
        />
        <SliderField
          label="Space Between Suggestions"
          value={typography.triviaSpaceBetweenSuggestions}
          onValueChange={(v) => patchTypography({ triviaSpaceBetweenSuggestions: v })}
          min={0}
          max={24}
          step={1}
          format="pt"
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Solution Page Spacing</Label>
        <SliderField
          label="Solution Font Size"
          value={typography.answerFontSize}
          onValueChange={(v) => patchTypography({ answerFontSize: v })}
          min={0}
          max={28}
          step={1}
          format="pt"
        />
        <SliderField
          label="Space Between Answers"
          value={typography.triviaSolutionSpaceBetween}
          onValueChange={(v) => patchTypography({ triviaSolutionSpaceBetween: v })}
          min={0}
          max={48}
          step={1}
          format="pt"
        />
        <p className="text-[11px] text-gray-500">
          Solutions use numbered answer tables in 1–4 columns. The page
          auto-scales so rows stay inside the safe margin.
        </p>
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Scale & Type</Label>
        <SliderField
          label="Puzzle Scale"
          value={core.puzzleGridScale}
          onValueChange={(v) => patchCore({ puzzleGridScale: v })}
          min={0}
          max={150}
          step={5}
          format="%"
        />
        <SliderField
          label="Question Font Size"
          value={typography.puzzleFontSize}
          onValueChange={(v) => patchTypography({ puzzleFontSize: v })}
          min={0}
          max={28}
          step={1}
          format="pt"
        />
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Question Font</Label>
          <Select
            value={typography.puzzleFontFamily}
            onValueChange={(value) => patchTypography({ puzzleFontFamily: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLISHING_FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <MiniColorInput
            label="Text Color"
            value={colors.gridColor}
            onChange={(v) => patchColors({ gridColor: v })}
          />
        </div>
      </div>
    </div>
  );
}

export function TriviaWordsSettingsPanel({ onSave }: { onSave?: () => void }) {
  const {
    core,
    patchCore,
    requiredQuestions,
    requiredSuggestions,
    requiredAnswers,
    pageCount,
    questionLines,
    suggestionLines,
    answerLines,
    submittedPer,
    missingSuggestions,
  } = useTriviaDoc();

  const missingQuestions = Math.max(0, requiredQuestions - questionLines.length);
  const missingAnswers = Math.max(0, requiredAnswers - answerLines.length);
  const willTrim =
    missingSuggestions === 0 &&
    submittedPer > core.suggestionsPerQuestion &&
    submittedPer > 0;

  return (
    <div className="space-y-4">
      <PanelHeader title="Questions & Answers" onSave={onSave} />

      <p className="text-xs text-gray-500">
        Need {requiredQuestions} questions ({pageCount} page
        {pageCount === 1 ? '' : 's'} × {core.questionsPerPage} per page),{' '}
        {requiredSuggestions} suggestions ({requiredQuestions} ×{' '}
        {core.suggestionsPerQuestion}), and {requiredAnswers} answers.
      </p>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Questions (one per line)</Label>
        <Textarea
          className="min-h-[110px]"
          value={core.questionsText}
          onChange={(e) => patchCore({ questionsText: e.target.value })}
          placeholder={
            'What is the recommended amount of daily water intake?\nHow many hours of sleep are recommended for adults?'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.stopPropagation();
          }}
        />
        <p className="text-xs text-gray-500">
          {questionLines.length} / {requiredQuestions} questions
        </p>
        {missingQuestions > 0 && (
          <p className="text-sm font-medium text-rose-700">
            {missingQuestions} more question{missingQuestions === 1 ? '' : 's'} needed
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Suggestions (one per line — all options in order)
        </Label>
        <p className="text-[11px] text-gray-500">
          For {core.suggestionsPerQuestion} suggestions × {requiredQuestions} questions,
          submit {requiredSuggestions} lines. Group options by question (Q1 options,
          then Q2 options, …).
        </p>
        <Textarea
          className="min-h-[140px]"
          value={core.suggestionsText}
          onChange={(e) => patchCore({ suggestionsText: e.target.value })}
          placeholder={'2 liters\n3 liters\n4 liters\n5 liters\n6–8 hours\n...'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.stopPropagation();
          }}
        />
        <p className="text-xs text-gray-500">
          {suggestionLines.length} / {requiredSuggestions} suggestions
          {submittedPer > 0 ? ` · ${submittedPer} per question submitted` : ''}
        </p>
        {missingSuggestions > 0 && (
          <p className="text-sm font-medium text-rose-700">
            Need {missingSuggestions} more suggestion
            {missingSuggestions === 1 ? '' : 's'}
          </p>
        )}
        {willTrim && (
          <p className="text-sm font-medium text-amber-700">
            Extra suggestions will be removed per question (answers kept; positions
            reshuffled).
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Answers (one per line)</Label>
        <p className="text-[11px] text-gray-500">
          One correct answer per question — use the suggestion text, a letter (A/B/C…),
          or a 1-based number.
        </p>
        <Textarea
          className="min-h-[100px]"
          value={core.answersText}
          onChange={(e) => patchCore({ answersText: e.target.value })}
          placeholder={'2 liters\n7–9 hours\n10,000 steps'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.stopPropagation();
          }}
        />
        <p className="text-xs text-gray-500">
          {answerLines.length} / {requiredAnswers} answers
        </p>
        {missingAnswers > 0 && (
          <p className="text-sm font-medium text-rose-700">
            {missingAnswers} more answer{missingAnswers === 1 ? '' : 's'} needed
          </p>
        )}
      </div>
    </div>
  );
}
