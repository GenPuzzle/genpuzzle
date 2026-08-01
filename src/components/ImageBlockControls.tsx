'use client';

import React, { useState } from 'react';
import {
  Contrast,
  Eraser,
  ImageIcon,
  Loader2,
  PenLine,
  Scaling,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { SliderField } from '@/components/ui/slider-field';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { TextPageBlock } from '@/lib/document-model';
import {
  buildBgRemovalTolerancePercent,
  DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE,
  DEFAULT_IMAGE_GRAYSCALE_CONTRAST,
  IMAGE_BLOCK_EFFECT_OPTIONS,
  removeImageBackground,
  type ImageBlockEffect,
  upscaleImage,
} from '@/lib/text-page-image-effects';
import { loadImageNaturalSize } from '@/lib/text-page-image-layout';

const EFFECT_ICONS: Record<ImageBlockEffect, React.ReactNode> = {
  none: <ImageIcon className="h-4 w-4" strokeWidth={2} aria-hidden />,
  grayscale: <Contrast className="h-4 w-4" strokeWidth={2} aria-hidden />,
  'coloring-page': <PenLine className="h-4 w-4" strokeWidth={2} aria-hidden />,
};

export function ImageBlockControls({
  block,
  onUpdate,
}: {
  block: TextPageBlock;
  onUpdate: (patch: Partial<TextPageBlock>) => void;
}) {
  const [busyAction, setBusyAction] = useState<'remove-bg' | 'upscale' | null>(null);

  const effect = block.imageEffect ?? 'none';
  const grayscaleContrast = block.imageGrayscaleContrast ?? DEFAULT_IMAGE_GRAYSCALE_CONTRAST;
  const bgTolerance = block.imageBgRemovalTolerance ?? DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE;

  const runImageTool = async (
    action: 'remove-bg' | 'upscale',
    runner: () => Promise<{ src: string; width: number; height: number }>
  ) => {
    if (!block.imageSrc || busyAction) return;
    setBusyAction(action);
    try {
      const { src, width, height } = await runner();
      onUpdate({
        imageSrc: src,
        imageNaturalWidth: width,
        imageNaturalHeight: height,
      });
      toast({
        title: action === 'remove-bg' ? 'Background removed' : 'Image upscaled',
        description:
          action === 'remove-bg'
            ? 'Transparent areas are ready for your page.'
            : `New size: ${width} × ${height}px`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Image tool failed',
        description: 'Try another image or adjust the tolerance.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleEffectSelect = (value: ImageBlockEffect) => {
    onUpdate({ imageEffect: value });
  };

  const handleRemoveBackground = () => {
    if (!block.imageSrc) return;
    void runImageTool('remove-bg', async () => {
      const src = await removeImageBackground(
        block.imageSrc!,
        buildBgRemovalTolerancePercent(block)
      );
      const { width, height } = await loadImageNaturalSize(src);
      return { src, width, height };
    });
  };

  const handleUpscale = () => {
    if (!block.imageSrc) return;
    void runImageTool('upscale', async () => {
      const src = await upscaleImage(block.imageSrc!, 2);
      const { width, height } = await loadImageNaturalSize(src);
      return { src, width, height };
    });
  };

  if (!block.imageSrc) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-gray-500">Effects</Label>
        <div className="image-effect-btn-grid">
          {IMAGE_BLOCK_EFFECT_OPTIONS.map((option) => {
            const active = effect === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn('image-effect-btn', active && 'image-effect-btn--active')}
                title={option.description}
                aria-pressed={active}
                onClick={() => handleEffectSelect(option.value)}
              >
                <span className="image-effect-btn__icon">{EFFECT_ICONS[option.value]}</span>
                <span className="image-effect-btn__label">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">
          {IMAGE_BLOCK_EFFECT_OPTIONS.find((option) => option.value === effect)?.description}
        </p>
      </div>

      {effect === 'grayscale' && (
        <div className="image-effect-controls">
          <SliderField
            label="Contrast"
            value={grayscaleContrast}
            onValueChange={(v) => onUpdate({ imageGrayscaleContrast: v })}
            min={0}
            max={100}
            step={1}
            format="%"
          />
        </div>
      )}

      {effect === 'coloring-page' && (
        <div className="image-effect-warning">
          <button
            type="button"
            className="image-effect-warning__ai-btn"
            disabled
            title="Coming soon"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Use AI to create coloring page style
            <span className="image-effect-warning__badge">Coming soon</span>
          </button>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-gray-500">Image tools</Label>
        <div className="image-tool-btn-row">
          <button
            type="button"
            className="image-tool-btn"
            disabled={!!busyAction}
            onClick={handleRemoveBackground}
            title="Remove solid background (samples corners)"
          >
            {busyAction === 'remove-bg' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
            <span>Remove BG</span>
          </button>
          <button
            type="button"
            className="image-tool-btn"
            disabled={!!busyAction}
            onClick={handleUpscale}
            title="Upscale image 2× with smooth sharpening"
          >
            {busyAction === 'upscale' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Scaling className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
            <span>Upscale 2×</span>
          </button>
        </div>
        <div className="image-effect-controls">
          <SliderField
            label="BG removal tolerance"
            value={bgTolerance}
            onValueChange={(v) => onUpdate({ imageBgRemovalTolerance: v })}
            min={0}
            max={100}
            step={1}
            format="%"
          />
          <p className="text-[10px] text-slate-500 leading-snug flex items-center gap-1">
            <Eraser className="h-3 w-3 shrink-0" aria-hidden />
            Increase if parts of the subject are erased; decrease if background remains.
          </p>
        </div>
      </div>
    </div>
  );
}
