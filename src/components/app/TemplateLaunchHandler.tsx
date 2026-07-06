'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { loadMarketingTemplate } from '@/lib/marketing/load-template';
import { takePendingTemplateId } from '@/lib/marketing/pending-template';

interface TemplateLaunchHandlerProps {
  onEnterEditor: () => void;
}

/** Opens a pending ?template= project after sign-in. */
export function TemplateLaunchHandler({ onEnterEditor }: TemplateLaunchHandlerProps) {
  const { session, isReady, inEditor } = useAuth();
  const app = useApp();
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!isReady || !session || inEditor || launchedRef.current) return;

    const templateId = takePendingTemplateId();
    if (!templateId) return;

    launchedRef.current = true;

    void loadMarketingTemplate(templateId)
      .then((project) => {
        app.loadProjectSnapshot(project);
        onEnterEditor();
        toast.success(`Opened template "${project.projectName}"`);
      })
      .catch((error) => {
        launchedRef.current = false;
        toast.error(error instanceof Error ? error.message : 'Failed to open template');
      });
  }, [isReady, session, inEditor, app, onEnterEditor]);

  return null;
}
