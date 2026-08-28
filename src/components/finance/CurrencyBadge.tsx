import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CurrencyBadgeProps {
  currency: string;
  className?: string;
}

export const CurrencyBadge: React.FC<CurrencyBadgeProps> = ({ currency, className }) => {
  const normalizedCurrency = currency.toUpperCase();
  const isBase = normalizedCurrency === 'VND';

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded',
        isBase
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        className
      )}
    >
      {normalizedCurrency}
    </Badge>
  );
};
