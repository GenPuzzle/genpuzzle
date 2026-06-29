import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'GenPuzzle App',
  description: 'Puzzle book editor — design, preview, and export your puzzle books.',
};

export default function PuzzleAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppShell>{children}</AppShell>
    </div>
  );
}
