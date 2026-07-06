'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AppFileMenu } from '@/components/AppFileMenu';
import { AppServicesMenu } from '@/components/AppServicesMenu';
import { AppUpgradeMenu } from '@/components/AppUpgradeMenu';
import { AppHeaderRightNav } from '@/components/AppHeaderRightNav';
import { ShareProjectDialog } from '@/components/ShareProjectDialog';
import { useProjectShare } from '@/hooks/useProjectShare';

export default function Header() {
  const { shareDialogOpen, setShareDialogOpen, shareUrl, openShareDialog, shareEnabled, projectName } =
    useProjectShare();

  return (
    <>
      <header
        className="relative flex items-center gap-2 px-3 py-2 border-b border-[#144a75] shadow-sm sm:gap-3 sm:px-4 pt-[env(safe-area-inset-top,0px)]"
        style={{ background: 'linear-gradient(to right, #1a5a8c 0%, #2276b4 100%)' }}
      >
        <Link
          href="/"
          className="flex shrink-0 items-center no-underline text-inherit hover:opacity-90 active:scale-95 transition-all duration-200"
          aria-label="GenPuzzle home"
        >
          <Image
            src="/genpuzzle-icon-white.svg"
            alt="GenPuzzle"
            height={32}
            width={32}
            priority
            className="h-8 w-8 object-contain drop-shadow-sm"
            unoptimized
          />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5 md:gap-2" aria-label="Main navigation">
          <AppFileMenu onShare={openShareDialog} shareEnabled={shareEnabled} />
          <AppServicesMenu />
          <AppUpgradeMenu />
        </nav>

        <AppHeaderRightNav onShare={openShareDialog} shareEnabled={shareEnabled} />
      </header>

      <ShareProjectDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        shareUrl={shareUrl}
        projectName={projectName}
      />
    </>
  );
}
