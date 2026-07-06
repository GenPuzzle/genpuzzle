'use client';

import { AppDownloadMenu } from '@/components/AppDownloadMenu';
import { HeaderExpandButton, HeaderExpandLink } from '@/components/HeaderExpandButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth-context';
import { useLeavePagePrompt } from '@/lib/leave-page-prompt-context';
import { BookOpen, Info, LogOut, Mail, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface AppHeaderRightNavProps {
  onShare: () => void;
  shareEnabled?: boolean;
}

export function AppHeaderRightNav({ onShare, shareEnabled = false }: AppHeaderRightNavProps) {
  const { logout } = useAuth();
  const { promptLeave } = useLeavePagePrompt();

  const handleSignOut = () => {
    promptLeave(() => {
      logout();
      toast.success('Signed out');
    }, { reason: 'sign-out' });
  };

  return (
    <nav className="flex items-center gap-1 sm:gap-1.5 md:gap-2" aria-label="Help and account">
      <ThemeToggle variant="header" />
      <AppDownloadMenu />
      <HeaderExpandButton
        expandSize="xl"
        label="Learn how to"
        icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={2.25} />}
        aria-label="Learn how to"
        onClick={() => toast.info('Help center coming soon')}
      />
      <HeaderExpandButton
        expandSize="md"
        label="About us"
        icon={<Info className="h-3.5 w-3.5" strokeWidth={2.25} />}
        aria-label="About us"
        hideBelow="sm"
        onClick={() => toast.info('About GenPuzzle coming soon')}
      />
      <HeaderExpandLink
        expandSize="lg"
        label="Contact us"
        icon={<Mail className="h-3.5 w-3.5" strokeWidth={2.25} />}
        aria-label="Contact us"
        hideBelow="md"
        href="mailto:support@genpuzzle.com"
      />
      <HeaderExpandButton
        expandSize="sm"
        label="Share"
        icon={<Share2 className="h-3.5 w-3.5" strokeWidth={2.25} />}
        aria-label="Share project"
        disabled={!shareEnabled}
        title={shareEnabled ? 'Share project' : 'Add content before sharing'}
        onClick={() => {
          if (shareEnabled) onShare();
        }}
      />
      <HeaderExpandButton
        expandSize="sm"
        label="Sign out"
        icon={<LogOut className="h-3.5 w-3.5" strokeWidth={2.25} />}
        aria-label="Sign out"
        hideBelow="md"
        onClick={handleSignOut}
      />
    </nav>
  );
}
