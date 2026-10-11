import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Enhance Coloring Pages — GenPuzzle',
  description: 'Clean AI-generated coloring pages and line art into print-ready SVG and PNG files.',
};

export default function EnhanceColoringPagesLayout({ children }: { children: ReactNode }) {
  return children;
}
