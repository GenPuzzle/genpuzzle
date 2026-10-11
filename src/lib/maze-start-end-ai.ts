import type { MazeStartEndStyle } from './maze-start-end-images';

export interface MazeImageDescription {
  startSubject: string;
  endSubject: string;
  startDescription: string;
  endDescription: string;
}

export async function requestMazeImageDescriptions(input: {
  theme: string;
  style: MazeStartEndStyle;
  sheetIndex: number;
  sheetCount: number;
  count: number;
  avoid?: string[];
}): Promise<MazeImageDescription[]> {
  let response: Response;
  try {
    response = await fetch('/api/ai/maze-image-descriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: input.theme,
        style: input.style,
        sheetIndex: input.sheetIndex,
        sheetCount: input.sheetCount,
        count: input.count,
        avoid: input.avoid ?? [],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new Error(timedOut ? 'AI generation timed out. Please try again.' : 'AI request failed');
  }
  const json = (await response.json()) as {
    ok?: boolean;
    data?: { pairs?: MazeImageDescription[] };
    error?: string;
  };
  if (!response.ok || !json.ok || !json.data?.pairs?.length) {
    throw new Error(json.error || 'AI generation could not be completed.');
  }
  return json.data.pairs;
}
