import React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Home,
  Film,
  HeartPulse,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';
import type { ExtendedBudget } from '@/features/budgets';
import type { MockBudget } from '@/types/finance';
import { Progress } from '@/components/ui/progress';
import { formatExactMoney, formatMoney } from '@/lib/money/format';
import { cn } from '@/lib/utils';

interface BudgetProgressProps {
  budget: ExtendedBudget | MockBudget;
  onClick?: () => void;
}

export const BudgetProgress: React.FC<BudgetProgressProps> = ({
  budget,
  onClick,
}) => {
  const isExtended = 'limit_amount' in budget;

  const categoryName = isExtended ? budget.categoryName : budget.categoryName;
  const categoryIcon = isExtended ? budget.categoryIcon : budget.categoryIcon;
  const categoryColor = isExtended ? budget.categoryColor : budget.categoryColor;
  const currency = isExtended ? budget.currency_code : budget.currency;

  let percent = 0;
  let isOver = false;
  let isNear = false;
  let displaySpent = '';
  let displayLimit = '';
  let displayRemaining = '';

  if (isExtended) {
    percent = Math.floor(budget.basisPoints / 100);
    isOver = budget.isOverBudget;
    isNear = percent >= 85 && percent <= 100;
    displaySpent = formatExactMoney(budget.spent_amount, currency);
    displayLimit = formatExactMoney(budget.limit_amount, currency);
    displayRemaining = isOver
      ? `Vượt ngân sách`
      : `Còn lại ${formatExactMoney(budget.remaining_amount, currency)}`;
  } else {
    percent = Math.round((budget.spent / budget.limit) * 100);
    isOver = percent > 100;
    isNear = percent >= 85 && percent <= 100;
    const remaining = budget.limit - budget.spent;
    displaySpent = formatMoney(budget.spent, currency);
    displayLimit = formatMoney(budget.limit, currency);
    displayRemaining = isOver
      ? 'Vượt ngân sách'
      : `Còn lại ${formatMoney(remaining, currency)}`;
  }

  const getIcon = () => {
    switch (categoryIcon) {
      case 'Utensils':
        return <Utensils className="h-4 w-4" />;
      case 'Car':
        return <Car className="h-4 w-4" />;
      case 'ShoppingBag':
        return <ShoppingBag className="h-4 w-4" />;
      case 'Home':
        return <Home className="h-4 w-4" />;
      case 'Film':
        return <Film className="h-4 w-4" />;
      case 'HeartPulse':
        return <HeartPulse className="h-4 w-4" />;
      default:
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border bg-card transition-all duration-200 hover:shadow-xs space-y-3 cursor-pointer',
        isOver
          ? 'border-red-200 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
          : isNear
          ? 'border-amber-200 dark:border-amber-900/60'
          : 'border-border'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: categoryColor }}
          >
            {getIcon()}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">
              {categoryName}
            </h4>
            <span className="text-xs text-muted-foreground">
              Định mức: {displayLimit}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end space-x-1">
            {isOver && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            <span
              className={cn(
                'text-sm font-bold',
                isOver
                  ? 'text-red-600 dark:text-red-400'
                  : isNear
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground'
              )}
            >
              {percent}%
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {displayRemaining}
          </span>
        </div>
      </div>

      <Progress
        value={Math.min(percent, 100)}
        className="h-2"
        indicatorClassName={
          isOver
            ? 'bg-red-500'
            : isNear
            ? 'bg-amber-500'
            : 'bg-emerald-500'
        }
      />

      <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
        <span>Đã chi: {displaySpent}</span>
        <span>Hạn mức: {displayLimit}</span>
      </div>
    </div>
  );
};
