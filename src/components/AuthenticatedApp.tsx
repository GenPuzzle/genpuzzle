'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { LoginPage } from '@/components/auth/LoginPage';
import { ProjectHomePage } from '@/components/auth/ProjectHomePage';
import { TemplateLaunchHandler } from '@/components/app/TemplateLaunchHandler';
import { TemplateUrlCapture } from '@/components/app/TemplateUrlCapture';
import { LeavePagePromptProvider } from '@/lib/leave-page-prompt-context';
import { useAuth } from '@/lib/auth-context';

export function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, isReady, inEditor, enterEditor } = useAuth();
  const isStandaloneTool = pathname.startsWith('/app/other-tools');

  useEffect(() => {
    if (isReady && session && isStandaloneTool && !inEditor) {
      enterEditor();
    }
  }, [isReady, session, isStandaloneTool, inEditor, enterEditor]);

  if (!isReady) {
    return (
      <>
        <TemplateUrlCapture />
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0f5f6] via-white to-[#e8f1f8] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gp-blue)]" />
        </div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <TemplateUrlCapture />
        <LoginPage />
      </>
    );
  }

  const showEditor = inEditor || isStandaloneTool;

  return (
    <LeavePagePromptProvider>
      <TemplateUrlCapture />
      {!showEditor ? (
        <>
          <TemplateLaunchHandler onEnterEditor={enterEditor} />
          <ProjectHomePage onEnterEditor={enterEditor} />
        </>
      ) : (
        <>
          <Header />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        </>
      )}
    </LeavePagePromptProvider>
  );
}
