import type { Puzzle } from './puzzles';
import type { WordSearchPuzzle } from './puzzles/types';
import type { PersistedAppSettings } from './settings-persistence';

export const GP_FILE_EXTENSION = '.gp';
export const GP_MIME_TYPE = 'application/x-genpuzzle+json';

export interface GpProjectFile {
  format: 'genpuzzle-project';
  formatVersion: 1;
  savedAt: string;
  projectName: string;
  settings: PersistedAppSettings;
  batchPuzzles: WordSearchPuzzle[];
  currentPuzzle: Puzzle | null;
  currentBatchIndex: number;
}

export function isGpProjectFile(value: unknown): value is GpProjectFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<GpProjectFile>;
  return file.format === 'genpuzzle-project' && file.formatVersion === 1 && !!file.settings;
}

export function parseGpProjectJson(text: string): GpProjectFile {
  const parsed = JSON.parse(text) as unknown;
  if (!isGpProjectFile(parsed)) {
    throw new Error('Invalid GenPuzzle project file.');
  }
  return parsed;
}

export function serializeGpProject(project: GpProjectFile): string {
  return JSON.stringify(project, null, 2);
}

export function downloadGpProject(project: GpProjectFile, filename?: string): void {
  const safeName = (filename || project.projectName || 'puzzle-book')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .trim();
  const blob = new Blob([serializeGpProject(project)], { type: GP_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName.endsWith(GP_FILE_EXTENSION) ? safeName : `${safeName}${GP_FILE_EXTENSION}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readGpProjectFromFile(file: File): Promise<GpProjectFile> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(GP_FILE_EXTENSION)) {
      reject(new Error(`Only ${GP_FILE_EXTENSION} project files are supported.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseGpProjectJson(String(reader.result ?? '')));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to read project file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read project file.'));
    reader.readAsText(file);
  });
}

/** Encode project for URL sharing (base64url). */
export function encodeProjectForShare(project: GpProjectFile): string {
  const json = JSON.stringify(project);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeProjectFromShare(encoded: string): GpProjectFile {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return parseGpProjectJson(json);
}

export const MAX_SHARE_URL_LENGTH = 6000;

export function buildShareUrl(project: GpProjectFile): string {
  if (typeof window === 'undefined') return '';
  const encoded = encodeProjectForShare(project);
  const url = `${window.location.origin}${window.location.pathname}#gp=${encoded}`;
  if (url.length > MAX_SHARE_URL_LENGTH) {
    throw new Error('Project is too large to share as a link. Please save as a .gp file instead.');
  }
  return url;
}

export function extractSharedProjectFromLocation(): GpProjectFile | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#gp=')) return null;
  try {
    return decodeProjectFromShare(hash.slice(4));
  } catch {
    return null;
  }
}

export function clearShareHashFromUrl(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith('#gp=')) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
