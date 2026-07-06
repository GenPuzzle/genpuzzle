'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

const LIGHT_THEME_COLOR = '#1a5a8c';
const DARK_THEME_COLOR = '#0f172a';

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const color = resolvedTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }, [resolvedTheme, mounted]);

  return null;
}
