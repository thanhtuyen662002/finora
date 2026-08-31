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
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
    xl: 'h-12 w-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  if (variant === 'icon') {
    return (
      <div className={cn("relative shrink-0 flex items-center justify-center", iconSizeMap[size], className)}>
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-xs">
          <defs>
            <linearGradient id="finora-ribbon-1-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="finora-ribbon-2-comp" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="finora-dot-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path d="M 25 15 C 45 5, 80 10, 95 30 C 105 45, 90 55, 65 52 C 45 50, 30 40, 25 15 Z" fill="url(#finora-ribbon-1-comp)" />
          <path d="M 20 40 C 40 32, 70 38, 85 50 C 92 56, 80 65, 55 62 C 35 60, 22 52, 20 40 Z" fill="url(#finora-ribbon-2-comp)" />
          <path d="M 18 80 C 12 55, 25 25, 50 15 C 32 30, 28 58, 38 82 C 32 88, 22 88, 18 80 Z" fill="url(#finora-ribbon-1-comp)" />
          <circle cx="28" cy="85" r="14" fill="url(#finora-dot-comp)" />
        </svg>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2.5 select-none", className)}>
      <div className={cn("relative shrink-0 flex items-center justify-center", iconSizeMap[size])}>
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-xs">
          <defs>
            <linearGradient id="finora-ribbon-1-full" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="finora-ribbon-2-full" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="finora-dot-full" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path d="M 25 15 C 45 5, 80 10, 95 30 C 105 45, 90 55, 65 52 C 45 50, 30 40, 25 15 Z" fill="url(#finora-ribbon-1-full)" />
          <path d="M 20 40 C 40 32, 70 38, 85 50 C 92 56, 80 65, 55 62 C 35 60, 22 52, 20 40 Z" fill="url(#finora-ribbon-2-full)" />
          <path d="M 18 80 C 12 55, 25 25, 50 15 C 32 30, 28 58, 38 82 C 32 88, 22 88, 18 80 Z" fill="url(#finora-ribbon-1-full)" />
          <circle cx="28" cy="85" r="14" fill="url(#finora-dot-full)" />
        </svg>
      </div>

      <div className="flex flex-col justify-center">
        <span className={cn("font-extrabold tracking-tight text-foreground leading-none flex items-center", textSizes[size])}>
          Finora
        </span>
        {showSubtitle && (
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
            Personal Finance OS
          </span>
        )}
      </div>
    </div>
  );
};
