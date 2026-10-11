'use client';

import { ColoringEnhanceProvider } from '@/lib/coloring-enhance-context';
import { ColoringEnhanceWorkspace } from '@/components/coloring-enhance/ColoringEnhanceWorkspace';

export default function EnhanceColoringPagesPage() {
  return (
    <ColoringEnhanceProvider>
      <ColoringEnhanceWorkspace />
    </ColoringEnhanceProvider>
  );
}
