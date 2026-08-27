import React from 'react';
import { CurrencyCode } from '@/types/finance';
import { formatMoney, formatConverted } from '@/lib/money/format';
import { cn } from '@/lib/utils';

interface MoneyAmountProps {
  amount: number;
  currency?: CurrencyCode;
  baseAmountVND?: number;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'NEUTRAL';
  showSign?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showConverted?: boolean;
}

export const MoneyAmount: React.FC<MoneyAmountProps> = ({
  amount,
  currency = 'VND',
  baseAmountVND,
  type = 'NEUTRAL',
  showSign = false,
  className,
  size = 'md',
  showConverted = true,
}) => {
  const sizeClasses = {
    sm: 'text-xs font-medium',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
    xl: 'text-2xl sm:text-3xl font-extrabold tracking-tight',
  };

  const typeColorClasses = {
    INCOME: 'text-emerald-600 dark:text-emerald-400',
    EXPENSE: 'text-slate-900 dark:text-slate-100',
    TRANSFER: 'text-blue-600 dark:text-blue-400',
    NEUTRAL: 'text-slate-900 dark:text-slate-100',
  };

  const isForeign = currency !== 'VND';
  const prefix = showSign ? (type === 'INCOME' ? '+' : type === 'EXPENSE' ? '-' : '') : '';

  return (
    <div className="inline-flex flex-col items-start leading-tight">
      <span className={cn(sizeClasses[size], typeColorClasses[type], className)}>
        {prefix}
        {formatMoney(Math.abs(amount), currency)}
      </span>
      {isForeign && showConverted && baseAmountVND && (
        <span className="text-[11px] text-muted-foreground font-normal mt-0.5">
          {formatConverted(baseAmountVND, 'VND')}
        </span>
      )}
    </div>
  );
};
