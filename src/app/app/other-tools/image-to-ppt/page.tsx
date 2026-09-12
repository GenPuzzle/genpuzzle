'use client';

import { ImageToPptProvider } from '@/lib/image-to-ppt-context';
import { ImageToPptWorkspace } from '@/components/image-to-ppt/ImageToPptWorkspace';

export default function ImageToEditablePptPage() {
  return (
    <ImageToPptProvider>
      <ImageToPptWorkspace />
    </ImageToPptProvider>
  );
}
