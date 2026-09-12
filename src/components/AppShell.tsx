'use client';

import { AppProvider } from '@/lib/settings-context';
import { AuthProvider } from '@/lib/auth-context';
import { AppBusyProvider } from '@/lib/app-busy-context';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { AppBusyOverlay } from '@/components/AppBusyOverlay';
import GlobalClientEffects from '@/components/GlobalClientEffects';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthProvider>
        <AppBusyProvider>
          <div className="flex h-screen flex-col overflow-hidden">
            <AuthenticatedApp>{children}</AuthenticatedApp>
          </div>
          <AppBusyOverlay />
          <GlobalClientEffects />
        </AppBusyProvider>
      </AuthProvider>
    </AppProvider>
  );
}
