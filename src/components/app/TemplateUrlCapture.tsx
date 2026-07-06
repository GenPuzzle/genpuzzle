'use client';

import { useEffect } from 'react';
import { captureTemplateFromUrl } from '@/lib/marketing/pending-template';

export function TemplateUrlCapture() {
  useEffect(() => {
    captureTemplateFromUrl();
  }, []);

  return null;
}
