'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { LoginPage } from '@/components/auth/LoginPage';
import { ProjectHomePage } from '@/components/auth/ProjectHomePage';
import { LeavePagePromptProvider } from '@/lib/leave-page-prompt-context';
import { useAuth } from '@/lib/auth-context';

export function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  const { session, isReady, inEditor, enterEditor } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--gp-blue)]" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <LeavePagePromptProvider>
      {!inEditor ? (
        <ProjectHomePage onEnterEditor={enterEditor} />
      ) : (
        <>
          <Header />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        </>
      )}
    </LeavePagePromptProvider>
  );
}
