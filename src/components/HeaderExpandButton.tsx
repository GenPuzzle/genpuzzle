'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const HEADER_BAR_BLUE = '#1a5a8c';

export type HeaderExpandHoverWidth = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const hoverWidthClass: Record<HeaderExpandHoverWidth, string> = {
  sm: 'header-expand-btn--sm',
  md: 'header-expand-btn--md',
  lg: 'header-expand-btn--lg',
  xl: 'header-expand-btn--xl',
  xxl: 'header-expand-btn--xxl',
};

interface HeaderExpandButtonBaseProps {
  icon: React.ReactNode;
  label: string;
  expandSize?: HeaderExpandHoverWidth;
  className?: string;
  hideBelow?: 'sm' | 'md';
}

type HeaderExpandButtonProps = HeaderExpandButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement>;

type HeaderExpandLinkProps = HeaderExpandButtonBaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement>;

function ExpandButtonContent({ icon, label }: Pick<HeaderExpandButtonBaseProps, 'icon' | 'label'>) {
  return (
    <>
      <span className="header-expand-btn__sign">{icon}</span>
      <span className="header-expand-btn__text">{label}</span>
    </>
  );
}

function getVisibilityClass(hideBelow?: 'sm' | 'md') {
  if (hideBelow === 'sm') return 'hidden sm:inline-flex';
  if (hideBelow === 'md') return 'hidden md:inline-flex';
  return 'inline-flex';
}

export const HeaderExpandButton = React.forwardRef<HTMLButtonElement, HeaderExpandButtonProps>(
  ({ icon, label, expandSize = 'md', className, hideBelow, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'header-expand-btn',
          hoverWidthClass[expandSize],
          getVisibilityClass(hideBelow),
          className
        )}
        {...props}
      >
        <ExpandButtonContent icon={icon} label={label} />
      </button>
    );
  }
);
HeaderExpandButton.displayName = 'HeaderExpandButton';

export const HeaderExpandLink = React.forwardRef<HTMLAnchorElement, HeaderExpandLinkProps>(
  ({ icon, label, expandSize = 'md', className, hideBelow, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          'header-expand-btn',
          hoverWidthClass[expandSize],
          getVisibilityClass(hideBelow),
          className
        )}
        {...props}
      >
        <ExpandButtonContent icon={icon} label={label} />
      </a>
    );
  }
);
HeaderExpandLink.displayName = 'HeaderExpandLink';
