import { parseGpProjectJson, type GpProjectFile } from '@/lib/project-file';
import { getTemplateById } from '@/lib/marketing/content';
import { buildTemplateProject } from '@/lib/marketing/template-projects';

/** Load a marketing template — tries static .gp file first, then built-in recipe. */
export async function loadMarketingTemplate(templateId: string): Promise<GpProjectFile> {
  const meta = getTemplateById(templateId);
  if (!meta) {
    throw new Error('Template not found.');
  }

  try {
    const response = await fetch(meta.gpFile, { cache: 'no-store' });
    if (response.ok) {
      const text = await response.text();
      return parseGpProjectJson(text);
    }
  } catch {
    /* fall through to built-in recipe */
  }

  return buildTemplateProject(templateId);
}
