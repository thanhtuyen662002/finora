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
  Edit2,
  Archive,
  RotateCcw,
} from 'lucide-react';
import type { ExtendedBudget } from '@/features/budgets';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatExactMoney } from '@/lib/money/format';
import { subExactDecimals } from '@/lib/money';
import { cn } from '@/lib/utils';

interface BudgetProgressProps {
  budget: ExtendedBudget;
  onClick?: () => void;
  onEdit?: (budget: ExtendedBudget) => void;
  onArchive?: (budget: ExtendedBudget) => void;
  onUnarchive?: (budget: ExtendedBudget) => void;
}

export const BudgetProgress: React.FC<BudgetProgressProps> = ({
  budget,
  onClick,
  onEdit,
  onArchive,
  onUnarchive,
}) => {
  const categoryName = budget.categoryName || 'Không có danh mục';
  const categoryIcon = budget.categoryIcon || 'MoreHorizontal';
  const categoryColor = budget.categoryColor || '#64748b';
  const currency = budget.currency_code;

  const percent = Math.floor(budget.basisPoints / 100);
  const isOver = budget.isOverBudget;
  const isNear = percent >= 85 && !isOver;
  const displaySpent = formatExactMoney(budget.spent_amount, currency);
  const displayLimit = formatExactMoney(budget.limit_amount, currency);

  let displayRemaining = '';
  if (isOver) {
    const overage = subExactDecimals(budget.spent_amount, budget.limit_amount);
    displayRemaining = `Vượt ${formatExactMoney(overage, currency)}`;
  } else {
    displayRemaining = `Còn lại ${formatExactMoney(budget.remaining_amount, currency)}`;
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
        'p-4 rounded-xl border bg-card transition-all duration-200 hover:shadow-xs space-y-3',
        budget.is_archived ? 'opacity-60 bg-muted/20 border-dashed' : '',
        isOver && !budget.is_archived
          ? 'border-red-200 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
          : isNear && !budget.is_archived
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
            <div className="flex items-center space-x-1.5">
              <h4 className="font-semibold text-sm text-foreground">
                {categoryName}
              </h4>
              {budget.is_archived && (
                <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1 py-0">
                  Lưu trữ
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Định mức: {displayLimit}
            </span>
          </div>
        </div>

        <div className="text-right flex items-center space-x-2">
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
            <span className={cn(
              "text-[11px]",
              isOver ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
            )}>
              {displayRemaining}
            </span>
          </div>

          {(onEdit || onArchive || onUnarchive) && (
            <div className="flex items-center space-x-1 ml-1" onClick={(e) => e.stopPropagation()}>
              {onEdit && !budget.is_archived && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(budget)}
                  title="Chỉnh sửa ngân sách"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {onArchive && !budget.is_archived && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                  onClick={() => onArchive(budget)}
                  title="Lưu trữ ngân sách"
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              )}
              {onUnarchive && budget.is_archived && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                  onClick={() => onUnarchive(budget)}
                  title="Khôi phục ngân sách"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
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
