/* eslint-disable @next/next/no-img-element */
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface FinoraLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

export const FinoraLogo: React.FC<FinoraLogoProps> = ({
  variant = 'full',
  size = 'md',
  className,
  showSubtitle = false,
}) => {
  const iconSizeMap = {
    sm: 'h-6 w-auto max-w-[24px]',
    md: 'h-8 w-auto max-w-[32px]',
    lg: 'h-10 w-auto max-w-[40px]',
    xl: 'h-12 w-auto max-w-[48px]',
  };

  const fullSizeMap = {
    sm: 'h-6 w-auto max-w-[110px]',
    md: 'h-8 w-auto max-w-[140px]',
    lg: 'h-10 w-auto max-w-[175px]',
    xl: 'h-12 w-auto max-w-[210px]',
  };

  if (variant === 'icon') {
    return (
      <div className={cn("relative shrink-0 flex items-center justify-center select-none", className)}>
        <img
          src="/brand/finora-icon.png"
          alt="Finora"
          className={cn("object-contain", iconSizeMap[size])}
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex flex-col select-none", className)}>
      <div className="relative shrink-0 flex items-center">
        <img
          src="/brand/finora-logo-light.png"
          alt="Finora"
          className={cn("dark:hidden object-contain", fullSizeMap[size])}
        />
        <img
          src="/brand/finora-logo-dark.png"
          alt="Finora"
          className={cn("hidden dark:block object-contain", fullSizeMap[size])}
        />
      </div>
      {showSubtitle && (
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
          Personal Finance OS
        </span>
      )}
    </div>
  );
};