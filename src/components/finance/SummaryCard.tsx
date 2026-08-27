import React from 'react';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  highlight?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  highlight = false,
}) => {
  return (
    <Card
      className={cn(
        'transition-all duration-200',
        highlight
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-md'
          : 'bg-card text-card-foreground border'
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-xs font-medium uppercase tracking-wider',
              highlight ? 'text-slate-300 dark:text-slate-600' : 'text-muted-foreground'
            )}
          >
            {title}
          </span>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              highlight
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xl sm:text-2xl font-bold tracking-tight">{value}</p>
          {(subtext || trend) && (
            <div className="mt-1 flex items-center space-x-1.5 text-xs">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center font-medium',
                    trend.isPositive
                      ? 'text-emerald-500'
                      : 'text-red-500'
                  )}
                >
                  {trend.isPositive ? (
                    <TrendingUp className="mr-0.5 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-0.5 h-3 w-3" />
                  )}
                  {trend.value}
                </span>
              )}
              {subtext && (
                <span
                  className={
                    highlight ? 'text-slate-300 dark:text-slate-600' : 'text-muted-foreground'
                  }
                >
                  {subtext}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
