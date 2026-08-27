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
import { MockBudget } from '@/types/finance';
import { Progress } from '@/components/ui/progress';
import { formatMoney } from '@/lib/money/format';
import { cn } from '@/lib/utils';

interface BudgetProgressProps {
  budget: MockBudget;
  onClick?: () => void;
}

export const BudgetProgress: React.FC<BudgetProgressProps> = ({
  budget,
  onClick,
}) => {
  const percent = Math.round((budget.spent / budget.limit) * 100);
  const remaining = budget.limit - budget.spent;
  const isOver = percent > 100;
  const isNear = percent >= 85 && percent <= 100;

  const getIcon = () => {
    switch (budget.categoryIcon) {
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
            style={{ backgroundColor: budget.categoryColor }}
          >
            {getIcon()}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">
              {budget.categoryName}
            </h4>
            <span className="text-xs text-muted-foreground">
              Định mức: {formatMoney(budget.limit, budget.currency)}
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
            {isOver ? 'Vượt ngân sách' : `Còn lại ${formatMoney(remaining, budget.currency)}`}
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
        <span>Đã chi: {formatMoney(budget.spent, budget.currency)}</span>
        <span>Hạn mức: {formatMoney(budget.limit, budget.currency)}</span>
      </div>
    </div>
  );
};
