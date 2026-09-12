'use client';

import React from 'react';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import type { MurdokuPuzzle } from '@/lib/puzzles/murdoku';
import { characterAtCell } from '@/lib/puzzles/murdoku';
import type { MurdokuSettings } from '@/lib/murdoku-settings';
import { murdokuLineForPuzzle, normalizeMurdokuSettings } from '@/lib/murdoku-settings';
import { computeMurdokuPageLayout, type MurdokuPagePart } from '@/lib/murdoku-page-layout';
import { getPageDimensionsInches } from '@/lib/puzzle-layout';
import { resolvePageFrameSettings, type PageFrameSettings } from '@/lib/page-frame-settings';
import { PageBackgroundImage } from '@/components/puzzle/PageBackgroundImage';
import { PageNumberOverlay } from '@/components/page-number/PageNumberOverlay';
import { resolveGenericPageSurfaceColors } from '@/lib/generic-page-chrome';

const PT_TO_PX = 96 / 72;

function FrameOverlay({
  frame,
  pageBackgroundColor,
  hasBackgroundImage,
}: {
  frame: PageFrameSettings;
  pageBackgroundColor: string;
  hasBackgroundImage: boolean;
}) {
  if (!frame.enabled) return null;
  const marginPx = frame.marginSizeIn * 96;
  const inset = { left: marginPx, top: marginPx, right: marginPx, bottom: marginPx };
  return (
    <>
      {hasBackgroundImage ? (
        <div
          className="absolute pointer-events-none z-[1]"
          style={{ ...inset, borderRadius: frame.cornerRadiusPx, backgroundColor: pageBackgroundColor }}
        />
      ) : null}
      <div
        className="absolute pointer-events-none z-[40]"
        style={{
          ...inset,
          borderRadius: frame.cornerRadiusPx,
          border: `${frame.strokeThicknessPx}px solid ${frame.borderColor}`,
          boxSizing: 'border-box',
        }}
      />
    </>
  );
}

function textCss(style: MurdokuSettings['textStyles'][keyof MurdokuSettings['textStyles']]) {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    color: style.color,
    textAlign: style.align as CanvasTextAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
    background: style.background,
    border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : undefined,
    borderRadius: style.borderRadius,
    whiteSpace: 'pre-wrap' as const,
  };
}

export function MurdokuPageCanvas({
  puzzle,
  settings,
  layoutSettings,
  showSolution,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  bookPageIndex,
  omitBackground = false,
  hidePageNumber = false,
  pagePart = 'single',
}: {
  puzzle: MurdokuPuzzle | null;
  settings: MurdokuSettings;
  layoutSettings: WordSearchSettings;
  showSolution: boolean;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  bookPageIndex?: number;
  omitBackground?: boolean;
  hidePageNumber?: boolean;
  pagePart?: MurdokuPagePart;
}) {
  const s = normalizeMurdokuSettings(settings);
  const dims = getPageDimensionsInches(layoutSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = pageWidthPt * PT_TO_PX;
  const heightPx = pageHeightPt * PT_TO_PX;
  const layout = computeMurdokuPageLayout(s, layoutSettings, widthPx, heightPx, pagePart);
  const frame = resolvePageFrameSettings(layoutSettings);
  const pageBg = resolveGenericPageSurfaceColors(layoutSettings, showSolution, '#ffffff');
  const bgColor = omitBackground ? 'transparent' : pageBg.backgroundColor;
  const showPageBackgroundImage = !omitBackground && !!pageBg.backgroundImage;

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none overflow-hidden"
      style={{ width: widthPx, height: heightPx, backgroundColor: bgColor, boxSizing: 'border-box' }}
    >
      {showPageBackgroundImage && pageBg.backgroundImage ? (
        <PageBackgroundImage
          src={pageBg.backgroundImage}
          opacity={pageBg.backgroundImageOpacity}
          fit={pageBg.backgroundImageFit}
        />
      ) : null}
      {!omitBackground ? (
        <FrameOverlay
          frame={frame}
          pageBackgroundColor={bgColor === 'transparent' ? '#ffffff' : bgColor}
          hasBackgroundImage={showPageBackgroundImage}
        />
      ) : null}
      {showMargins ? (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40"
          style={{
            left: layout.marginPx,
            top: layout.marginPx,
            right: layout.marginPx,
            bottom: layout.marginPx,
          }}
        />
      ) : null}
      {showSafetyZone ? (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        />
      ) : null}

      {puzzle ? (
        <MurdokuPageContent puzzle={puzzle} settings={s} layout={layout} showSolution={showSolution} />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 z-10"
          style={{ padding: layout.marginPx }}
        >
          Generate a Murdoku puzzle to preview this page.
        </div>
      )}

      {!hidePageNumber && bookPageIndex != null ? (
        <PageNumberOverlay
          settings={layoutSettings}
          bookPageIndex={bookPageIndex}
          pageWidthPt={pageWidthPt}
          pageHeightPt={pageHeightPt}
          ptToPx={(pt) => pt * PT_TO_PX}
        />
      ) : null}
    </div>
  );
}

function overlayMurdokuDisplay(puzzle: MurdokuPuzzle, settings: MurdokuSettings): MurdokuPuzzle {
  const charById = new Map(settings.characters.map((c) => [c.id, c]));
  const roomById = new Map(settings.rooms.map((r) => [r.id, r]));
  const index = puzzle.puzzleIndexInDocument ?? 0;
  const storyLine =
    murdokuLineForPuzzle(settings.story.intro, index) || puzzle.story.intro;
  return {
    ...puzzle,
    story: {
      ...puzzle.story,
      caseTitle:
        murdokuLineForPuzzle(settings.story.caseTitle, index, { repeatSingle: true }) ||
        puzzle.story.caseTitle,
      intro: storyLine,
      crimeDescription: settings.story.crimeDescription?.trim() || puzzle.story.crimeDescription,
      instruction: storyLine,
      victimName: settings.story.victimName?.trim() || puzzle.story.victimName,
      victimDescription: settings.story.victimDescription?.trim() || puzzle.story.victimDescription,
    },
    characters: puzzle.characters.map((c) => {
      const fromSettings = charById.get(c.id);
      if (!fromSettings) return c;
      return {
        ...c,
        name: fromSettings.name || c.name,
        description: fromSettings.description || c.description,
        clothingNotes: fromSettings.clothingNotes || c.clothingNotes,
        occupation: fromSettings.occupation || c.occupation,
        imageSrc: fromSettings.imageSrc || c.imageSrc,
        clueText: c.clueText,
      };
    }),
    rooms: puzzle.rooms.map((room) => {
      const fromSettings = roomById.get(room.id);
      if (!fromSettings) return room;
      return {
        ...room,
        name: fromSettings.name || room.name,
        color: fromSettings.color || room.color,
        slotId: fromSettings.slotId || room.slotId,
        imageSrc: fromSettings.imageSrc || room.imageSrc,
        description: fromSettings.description || room.description,
        labelVisible: fromSettings.labelVisible !== false,
      };
    }),
  };
}

function MurdokuPageContent({
  puzzle,
  settings,
  layout,
  showSolution,
}: {
  puzzle: MurdokuPuzzle;
  settings: MurdokuSettings;
  layout: ReturnType<typeof computeMurdokuPageLayout>;
  showSolution: boolean;
}) {
  const display = overlayMurdokuDisplay(puzzle, settings);
  const ts = settings.textStyles;
  const chars = display.characters.filter((c) => c.enabled);
  const title =
    display.story.caseTitle ||
    settings.theme.name ||
    'Murdoku';
  const number = display.puzzleNumber ?? settings.core.puzzlesStartingNumber;
  const victim = display.characters.find((c) => c.id === display.victimId);
  const storyText = display.story.intro || display.story.crimeDescription;
  const instructionText = display.story.instruction;
  const showInstructionBox =
    ts.instructions.visible &&
    layout.instructions.height > 0 &&
    Boolean(instructionText) &&
    (instructionText !== storyText || layout.story.height <= 0);

  return (
    <>
      {ts.title.visible && layout.title.height > 0 ? (
        <div
          className="absolute z-[5]"
          style={{
            left: layout.title.x,
            top: layout.title.y,
            width: layout.title.width,
            height: layout.title.height,
            ...textCss(ts.title),
          }}
        >
          {title}
        </div>
      ) : null}
      {ts.puzzleNumber.visible && layout.title.height > 0 ? (
        <div
          className="absolute z-[5]"
          style={{
            left: layout.title.x + layout.title.width * 0.7,
            top: layout.title.y,
            width: layout.title.width * 0.3,
            ...textCss(ts.puzzleNumber),
          }}
        >
          Puzzle {number}
        </div>
      ) : null}
      {ts.intro.visible && layout.story.height > 0 ? (
        <div
          className="absolute z-[5] overflow-hidden"
          style={{
            left: layout.story.x,
            top: layout.story.y,
            width: layout.story.width,
            height: layout.story.height,
            ...textCss(ts.intro),
          }}
        >
          {storyText}
        </div>
      ) : null}
      {showInstructionBox ? (
        <div
          className="absolute z-[5] overflow-hidden"
          style={{
            left: layout.instructions.x,
            top: layout.instructions.y,
            width: layout.instructions.width,
            height: layout.instructions.height,
            ...textCss(ts.instructions),
          }}
        >
          {instructionText}
        </div>
      ) : null}

      {layout.characters.height > 0 ? (
      <div
        className="absolute z-[6] flex overflow-hidden"
        style={{
          left: layout.characters.x,
          top: layout.characters.y,
          width: layout.characters.width,
          height: layout.characters.height,
          gap: settings.cards.spacing,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignContent: 'flex-start',
        }}
      >
        {chars.map((char) => (
          <div
            key={char.id}
            className="flex flex-col items-center shrink-0"
            style={{
              width: settings.cards.cardWidth,
              height: Math.min(settings.cards.cardHeight, layout.characters.height),
              padding: settings.cards.padding,
              border: `${settings.cards.borderWidth}px solid ${settings.cards.borderColor}`,
              borderRadius: settings.cards.borderRadius,
              background: settings.cards.background,
              boxShadow: settings.cards.shadow ? '0 1px 3px rgba(15,23,42,0.12)' : undefined,
            }}
          >
            <div
              style={{
                width: settings.cards.portraitWidth,
                height: settings.cards.portraitHeight,
                borderRadius:
                  settings.cards.imageShape === 'circle'
                    ? 999
                    : settings.cards.imageShape === 'rounded'
                      ? 8
                      : 0,
                overflow: 'hidden',
                border: `${settings.cards.imageBorderWidth}px solid ${settings.cards.borderColor}`,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#64748b',
              }}
            >
              {char.imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={char.imageSrc} alt={char.name} className="w-full h-full object-cover" />
              ) : (
                char.slotId
              )}
            </div>
            <div style={{ ...textCss(ts.characterName), width: '100%', fontSize: ts.characterName.fontSize }}>
              {char.name}
            </div>
            {char.clueText ? (
              <div
                style={{
                  ...textCss(ts.characterClue),
                  width: '100%',
                  fontSize: Math.max(7, ts.characterClue.fontSize),
                  lineHeight: 1.15,
                  overflow: 'hidden',
                }}
              >
                {char.clueText}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      ) : null}

      {ts.victimCard.visible && victim && layout.victim.height > 0 ? (
        <div
          className="absolute z-[6] overflow-hidden"
          style={{
            left: layout.victim.x,
            top: layout.victim.y,
            width: layout.victim.width,
            height: layout.victim.height,
            ...textCss(ts.victimCard),
          }}
        >
          <div className="font-semibold">Victim: {victim.name}</div>
          <div style={{ fontWeight: 400, fontSize: Math.max(9, ts.victimCard.fontSize - 1) }}>
            {display.story.victimDescription || victim.description}
          </div>
        </div>
      ) : null}

      {layout.grid.height > 0 ? (
      <MurdokuGrid
        puzzle={display}
        settings={settings}
        box={layout.grid}
        cellSize={layout.cellSize}
        showSolution={showSolution}
      />
      ) : null}

      {layout.clues.height > 0 ? (
      <div
        className="absolute z-[6] overflow-hidden"
        style={{
          left: layout.clues.x,
          top: layout.clues.y,
          width: layout.clues.width,
          height: layout.clues.height,
          fontFamily: ts.characterClue.fontFamily,
          fontSize: Math.max(18, ts.characterClue.fontSize),
          color: ts.characterClue.color,
          lineHeight: 1.35,
        }}
      >
        <div className="font-semibold mb-1" style={{ fontSize: Math.max(18, ts.characterClue.fontSize) }}>
          Clues
        </div>
        <ol className="list-decimal pl-4 space-y-0.5">
          {puzzle.clues
            .filter((c) => c.enabled)
            .map((clue) => (
              <li key={clue.id}>
                {settings.core.useSimpleLogicWording
                  ? clue.simpleText
                  : clue.displayText || clue.simpleText}
              </li>
            ))}
        </ol>
      </div>
      ) : null}

      {settings.deductionGrid.visible && !showSolution && layout.deduction.height > 0 ? (
        <div
          className="absolute z-[5]"
          style={{
            left: layout.deduction.x,
            top: layout.deduction.y,
            width: layout.deduction.width,
            height: layout.deduction.height,
            opacity: settings.deductionGrid.opacity / 100,
            background: settings.deductionGrid.background,
          }}
        >
          <div className="text-[10px] text-slate-500 mb-1">Deduction grid</div>
          <EmptyDeductionGrid
            rows={settings.core.rows}
            cols={settings.core.cols}
            border={settings.deductionGrid.borderThickness}
            showLabels={settings.deductionGrid.showLabels}
          />
        </div>
      ) : null}

      {layout.murdererLine.height > 0 && !showSolution ? (
        <div
          className="absolute z-[5] text-sm"
          style={{
            left: layout.murdererLine.x,
            top: layout.murdererLine.y,
            width: layout.murdererLine.width,
            height: layout.murdererLine.height,
          }}
        >
          The murderer was: ____________________________
        </div>
      ) : null}

      {showSolution && layout.legend.height > 0 ? (
        <div
          className="absolute z-[7] overflow-hidden"
          style={{
            left: layout.legend.x,
            top: layout.legend.y,
            width: layout.legend.width,
            height: layout.legend.height + layout.solutionRef.height,
            ...textCss(ts.solution),
          }}
        >
          Murderer: {display.characters.find((c) => c.id === display.murdererId)?.name}. {display.murdererReason}
          {settings.core.solutionStyle !== 'simple' &&
          (settings.story.solutionExplanation || display.story.solutionExplanation)
            ? `\n${settings.story.solutionExplanation || display.story.solutionExplanation}`
            : ''}
        </div>
      ) : ts.solutionRef.visible ? (
        <div
          className="absolute z-[5]"
          style={{
            left: layout.solutionRef.x,
            top: layout.solutionRef.y,
            width: layout.solutionRef.width,
            ...textCss(ts.solutionRef),
          }}
        >
          Solution on the answer pages.
        </div>
      ) : null}
    </>
  );
}

function EmptyDeductionGrid({
  rows,
  cols,
  border,
  showLabels,
}: {
  rows: number;
  cols: number;
  border: number;
  showLabels: boolean;
}) {
  return (
    <div className="w-full h-[calc(100%-16px)]">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: showLabels ? `12px repeat(${cols}, 1fr)` : `repeat(${cols}, 1fr)`,
          gridTemplateRows: showLabels ? `12px repeat(${rows}, 1fr)` : `repeat(${rows}, 1fr)`,
        }}
      >
        {showLabels ? <div /> : null}
        {showLabels
          ? Array.from({ length: cols }, (_, c) => (
              <div key={`c${c}`} className="text-[8px] text-center text-slate-400">
                {c + 1}
              </div>
            ))
          : null}
        {Array.from({ length: rows }, (_, r) => (
          <React.Fragment key={r}>
            {showLabels ? <div className="text-[8px] text-slate-400">{r + 1}</div> : null}
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={`${r}-${c}`}
                style={{ border: `${border}px solid #94a3b8`, background: '#fff' }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MurdokuGrid({
  puzzle,
  settings,
  box,
  cellSize,
  showSolution,
}: {
  puzzle: MurdokuPuzzle;
  settings: MurdokuSettings;
  box: { x: number; y: number; width: number; height: number };
  cellSize: number;
  showSolution: boolean;
}) {
  const g = settings.grid;
  const size = Math.min(cellSize, Math.floor((box.width - g.padding * 2) / puzzle.cols), Math.floor((box.height - g.padding * 2) / puzzle.rows));
  const gridW = size * puzzle.cols;
  const gridH = size * puzzle.rows;
  const dash =
    g.lineStyle === 'dashed' ? '4 3' : g.lineStyle === 'dotted' ? '1 3' : undefined;

  return (
    <div
      className="absolute z-[6]"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <svg width={gridW + g.padding * 2} height={gridH + g.padding * 2} className="overflow-visible">
        <g transform={`translate(${g.padding}, ${g.padding})`}>
          {Array.from({ length: puzzle.rows }, (_, row) =>
            Array.from({ length: puzzle.cols }, (_, col) => {
              const roomId = puzzle.cellRoomIds[row][col];
              const room = puzzle.rooms.find((r) => r.id === roomId);
              return (
                <rect
                  key={`bg-${row}-${col}`}
                  x={col * size}
                  y={row * size}
                  width={size}
                  height={size}
                  fill={
                    g.showRoomBackground && room
                      ? hexWithOpacity(room.color, g.roomBackgroundOpacity)
                      : '#ffffff'
                  }
                  stroke="none"
                />
              );
            })
          )}
          {puzzle.rooms.map((room) => {
            if (!room.imageSrc) return null;
            const cells: Array<{ row: number; col: number }> = [];
            for (let r = 0; r < puzzle.rows; r++) {
              for (let c = 0; c < puzzle.cols; c++) {
                if (puzzle.cellRoomIds[r][c] === room.id) cells.push({ row: r, col: c });
              }
            }
            if (!cells.length) return null;
            const minR = Math.min(...cells.map((c) => c.row));
            const maxR = Math.max(...cells.map((c) => c.row));
            const minC = Math.min(...cells.map((c) => c.col));
            const maxC = Math.max(...cells.map((c) => c.col));
            const clipId = `murdoku-room-${puzzle.pageId || puzzle.seed}-${room.id}`;
            return (
              <g key={`art-${room.id}`}>
                <defs>
                  <clipPath id={clipId}>
                    {cells.map((cell) => (
                      <rect
                        key={`${cell.row}-${cell.col}`}
                        x={cell.col * size}
                        y={cell.row * size}
                        width={size}
                        height={size}
                      />
                    ))}
                  </clipPath>
                </defs>
                <image
                  href={room.imageSrc}
                  x={minC * size}
                  y={minR * size}
                  width={(maxC - minC + 1) * size}
                  height={(maxR - minR + 1) * size}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`}
                  opacity={1}
                  pointerEvents="none"
                />
              </g>
            );
          })}
          {cellGridLines(puzzle.rows, puzzle.cols, size).map((line, i) => (
            <line
              key={`cell-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#111827"
              strokeWidth={Math.max(0.2, g.lineThickness)}
              strokeDasharray={dash}
              strokeLinecap="square"
              shapeRendering="crispEdges"
              pointerEvents="none"
            />
          ))}
          {Array.from({ length: puzzle.rows }, (_, row) =>
            Array.from({ length: puzzle.cols }, (_, col) => {
              const char = showSolution ? characterAtCell(puzzle, row, col) : undefined;
              const obj = puzzle.objects.find((o) => o.row === row && o.col === col);
              const el = obj
                ? settings.elements.find((e) => e.id === obj.elementId) ||
                  puzzle.elements?.find((e) => e.id === obj.elementId)
                : undefined;
              const isVictim = char?.id === puzzle.victimId;
              const isMurderer = char?.id === puzzle.murdererId;
              if (!obj && !char) return null;
              return (
                <g key={`piece-${row}-${col}`}>
                  {obj && el?.imageSrc ? (
                    <image
                      href={el.imageSrc}
                      x={col * size + size * 0.1}
                      y={row * size + size * 0.1}
                      width={size * (g.objectSize / 100)}
                      height={size * (g.objectSize / 100)}
                    />
                  ) : obj ? (
                    <text
                      x={col * size + size / 2}
                      y={row * size + size * 0.38}
                      textAnchor="middle"
                      fontSize={Math.max(7, size * 0.22)}
                      fill="#64748b"
                    >
                      {(el?.name || 'Obj').slice(0, 6)}
                    </text>
                  ) : null}
                  {char ? (
                    char.imageSrc ? (
                      <image
                        href={char.imageSrc}
                        x={col * size + size * 0.08}
                        y={row * size + size * 0.08}
                        width={size * (g.characterMarkerSize / 100)}
                        height={size * (g.characterMarkerSize / 100)}
                      />
                    ) : (
                      <text
                        x={col * size + size / 2}
                        y={row * size + size * 0.7}
                        textAnchor="middle"
                        fontSize={Math.max(8, size * 0.32)}
                        fontWeight={700}
                        fill={isMurderer ? '#b91c1c' : isVictim ? '#1d4ed8' : '#111827'}
                      >
                        {char.name.slice(0, 1)}
                      </text>
                    )
                  ) : null}
                </g>
              );
            })
          )}
          {roomPartitionLines(puzzle.cellRoomIds, size).map((line, i) => (
            <line
              key={`wall-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#111827"
              strokeWidth={g.roomBorderThickness}
              strokeLinecap="square"
              strokeLinejoin="miter"
              pointerEvents="none"
            />
          ))}
          {g.showRoomLabels
            ? puzzle.rooms.map((room) => {
                if (!room.labelVisible) return null;
                const cells: Array<{ row: number; col: number }> = [];
                for (let r = 0; r < puzzle.rows; r++) {
                  for (let c = 0; c < puzzle.cols; c++) {
                    if (puzzle.cellRoomIds[r][c] === room.id) cells.push({ row: r, col: c });
                  }
                }
                if (!cells.length) return null;
                const label = roomLabelBox(
                  cells,
                  size,
                  room.name,
                  settings.textStyles.roomLabel,
                  gridW,
                  gridH,
                  g.roomLabelPosition,
                  g.roomBorderThickness
                );
                if (!label) return null;
                const style = settings.textStyles.roomLabel;
                return (
                  <g key={`label-${room.id}`} pointerEvents="none">
                    <rect
                      x={label.x}
                      y={label.y}
                      width={label.w}
                      height={label.h}
                      rx={Math.max(6, style.borderRadius || 10)}
                      ry={Math.max(6, style.borderRadius || 10)}
                      fill={style.background && style.background !== 'transparent' ? style.background : '#ffffff'}
                      stroke={style.borderColor || '#111827'}
                      strokeWidth={style.borderWidth || 2}
                    />
                    <text
                      x={label.x + label.w / 2}
                      y={label.y + label.h / 2 + label.fontSize * 0.35}
                      textAnchor="middle"
                      fontSize={label.fontSize}
                      fontFamily={style.fontFamily}
                      fontWeight={style.bold === false ? 400 : 700}
                      fontStyle={style.italic ? 'italic' : 'normal'}
                      fill={style.color || '#111827'}
                    >
                      {room.name.toUpperCase()}
                    </text>
                  </g>
                );
              })
            : null}
          <rect
            x={0}
            y={0}
            width={gridW}
            height={gridH}
            fill="none"
            stroke="#111827"
            strokeWidth={g.outerBorderThickness}
            pointerEvents="none"
          />
          {g.showCoordinates
            ? Array.from({ length: puzzle.cols }, (_, c) => (
                <text
                  key={`col-${c}`}
                  x={c * size + size / 2}
                  y={-4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#64748b"
                >
                  {c + 1}
                </text>
              ))
            : null}
        </g>
      </svg>
    </div>
  );
}

function cellGridLines(
  rows: number,
  cols: number,
  size: number
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let c = 1; c < cols; c++) {
    lines.push({ x1: c * size, y1: 0, x2: c * size, y2: rows * size });
  }
  for (let r = 1; r < rows; r++) {
    lines.push({ x1: 0, y1: r * size, x2: cols * size, y2: r * size });
  }
  return lines;
}

function roomPartitionLines(
  cellRoomIds: string[][],
  size: number
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const rows = cellRoomIds.length;
  const cols = cellRoomIds[0]?.length ?? 0;
  const vertical = new Map<number, number[]>();
  const horizontal = new Map<number, number[]>();
  const add = (map: Map<number, number[]>, key: number, start: number) => {
    const list = map.get(key) ?? [];
    list.push(start);
    map.set(key, list);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cellRoomIds[r][c];
      if (c + 1 < cols && cellRoomIds[r][c + 1] !== id) add(vertical, c + 1, r);
      if (r + 1 < rows && cellRoomIds[r + 1][c] !== id) add(horizontal, r + 1, c);
    }
  }
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const [col, starts] of vertical) {
    const sorted = [...new Set(starts)].sort((a, b) => a - b);
    let run = sorted[0];
    let end = sorted[0];
    const flush = () => {
      lines.push({ x1: col * size, y1: run * size, x2: col * size, y2: (end + 1) * size });
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        flush();
        run = sorted[i];
        end = sorted[i];
      }
    }
    if (sorted.length) flush();
  }
  for (const [row, starts] of horizontal) {
    const sorted = [...new Set(starts)].sort((a, b) => a - b);
    let run = sorted[0];
    let end = sorted[0];
    const flush = () => {
      lines.push({ x1: run * size, y1: row * size, x2: (end + 1) * size, y2: row * size });
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        flush();
        run = sorted[i];
        end = sorted[i];
      }
    }
    if (sorted.length) flush();
  }
  return lines;
}

function longestEdgeRun(
  cells: Array<{ row: number; col: number }>,
  edge: 'top' | 'bottom'
): { row: number; startCol: number; length: number } {
  const edgeRow =
    edge === 'top'
      ? Math.min(...cells.map((cell) => cell.row))
      : Math.max(...cells.map((cell) => cell.row));
  const cols = cells
    .filter((cell) => cell.row === edgeRow)
    .map((cell) => cell.col)
    .sort((a, b) => a - b);
  let bestStart = cols[0] ?? 0;
  let bestLen = 1;
  let runStart = cols[0] ?? 0;
  let runLen = 1;
  for (let i = 1; i < cols.length; i++) {
    if (cols[i] === cols[i - 1] + 1) {
      runLen += 1;
    } else {
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
      runStart = cols[i];
      runLen = 1;
    }
  }
  if (runLen > bestLen) {
    bestLen = runLen;
    bestStart = runStart;
  }
  return { row: edgeRow, startCol: bestStart, length: Math.max(1, bestLen) };
}

function roomLabelBox(
  cells: Array<{ row: number; col: number }>,
  size: number,
  name: string,
  style: MurdokuSettings['textStyles']['roomLabel'],
  gridW: number,
  gridH: number,
  position: MurdokuSettings['grid']['roomLabelPosition'] = 'bottom',
  borderThickness = 4
): { x: number; y: number; w: number; h: number; fontSize: number } | null {
  if (!cells.length || !name) return null;
  const label = name.toUpperCase();
  const run = longestEdgeRun(cells, position === 'top' ? 'top' : 'bottom');
  const padX = Math.max(6, style.padding || 5);
  const padY = Math.max(3, Math.round((style.padding || 5) * 0.7));
  const maxW = Math.max(size * 1.4, run.length * size - 4);
  let fontSize = style.fontSize || 18;
  const minFont = style.minFontSize || 10;
  const textWidth = (text: string, fs: number) => text.length * fs * 0.62;
  while (fontSize > minFont && textWidth(label, fontSize) + padX * 2 > maxW) {
    fontSize -= 1;
  }
  const w = Math.min(gridW - 4, Math.max(size * 0.9, textWidth(label, fontSize) + padX * 2));
  const h = fontSize + padY * 2;
  const cx = (run.startCol + run.length / 2) * size;
  let x = cx - w / 2;
  x = Math.max(2, Math.min(gridW - w - 2, x));
  const inset = Math.max(3, borderThickness * 0.35);
  let y =
    position === 'top'
      ? run.row * size + inset
      : (run.row + 1) * size - h - inset;
  if (position === 'center') {
    const minR = Math.min(...cells.map((cell) => cell.row));
    const maxR = Math.max(...cells.map((cell) => cell.row));
    y = ((minR + maxR + 1) / 2) * size - h / 2;
  }
  y = Math.max(2, Math.min(gridH - h - 2, y));
  return { x, y, w, h, fontSize };
}

function hexWithOpacity(hex: string, opacityPercent: number): string {
  const raw = hex.replace('#', '');
  const n = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPercent)) / 100})`;
}
