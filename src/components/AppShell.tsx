'use client';

import { AppProvider } from '@/lib/settings-context';
import { AuthProvider } from '@/lib/auth-context';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import GlobalClientEffects from '@/components/GlobalClientEffects';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <AuthenticatedApp>{children}</AuthenticatedApp>
        </div>
        <GlobalClientEffects />
      </AuthProvider>
    </AppProvider>
  );
}
