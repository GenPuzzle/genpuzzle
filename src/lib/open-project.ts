/**
 * Single import path for Welcome "Open project" and File → Open Project.
 * Both UIs must: importGpProjectFile → loadProjectSnapshot → (then enter editor if needed).
 */
import { readGpProjectFromFile, type GpProjectFile } from './project-file';

export type LoadProjectSnapshot = (
  project: GpProjectFile,
  options?: { flush?: boolean }
) => void;

/**
 * Read a .gp file and apply it through the provided snapshot loader.
 * Always flushes React state before returning so Welcome → editor never
 * mounts against empty puzzle batches.
 */
export async function openProjectFromFile(
  file: File,
  loadProjectSnapshot: LoadProjectSnapshot
): Promise<GpProjectFile> {
  const project = await readGpProjectFromFile(file);
  loadProjectSnapshot(project, { flush: true });
  return project;
}
