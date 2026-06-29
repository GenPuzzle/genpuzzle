import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GenPuzzle — Puzzle book maker',
  description: 'Create and publish professional puzzle books with GenPuzzle.',
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen overflow-y-auto">{children}</div>;
}
