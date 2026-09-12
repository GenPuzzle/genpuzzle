import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Image to Editable PPT — GenPuzzle',
  description: 'Convert scanned pages into editable GenPuzzle documents and PowerPoint slides.',
};

export default function ImageToPptLayout({ children }: { children: ReactNode }) {
  return children;
}
