'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderExpandButton } from '@/components/HeaderExpandButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ThemeToggleProps = {
  variant?: 'default' | 'header' | 'marketing';
};

export function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const icon = !mounted ? (
    <Sun className="h-3.5 w-3.5" strokeWidth={2.25} />
  ) : isDark ? (
    <Sun className="h-3.5 w-3.5" strokeWidth={2.25} />
  ) : (
    <Moon className="h-3.5 w-3.5" strokeWidth={2.25} />
  );

  const menu = (
    <DropdownMenuContent align="end" className="w-36 z-[200]">
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <Sun className="mr-2 h-4 w-4" />
        Light
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <Moon className="mr-2 h-4 w-4" />
        Dark
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <Monitor className="mr-2 h-4 w-4" />
        System
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (variant === 'header') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <HeaderExpandButton
            expandSize="sm"
            label={isDark ? 'Light mode' : 'Dark mode'}
            icon={icon}
            aria-label="Toggle color theme"
            className="gp-theme-toggle"
          />
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  if (variant === 'marketing') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'gp-theme-toggle inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition',
              'hover:border-[var(--gp-blue)] hover:text-[var(--gp-blue)]',
              'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-[var(--gp-blue-light)]'
            )}
            aria-label="Toggle color theme"
          >
            {icon}
          </button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="gp-theme-toggle relative">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Theme</span>
        </Button>
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}
