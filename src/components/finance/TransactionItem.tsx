import React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Home,
  Film,
  HeartPulse,
  MoreHorizontal,
  Briefcase,
  Video,
  Laptop,
  TrendingUp,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { MockTransaction } from '@/types/finance';
import { formatMoney, formatConverted, formatDateVN } from '@/lib/money/format';
import { CurrencyBadge } from './CurrencyBadge';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
  transaction: MockTransaction;
  onClick?: () => void;
  compact?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onClick,
  compact = false,
}) => {
  const getCategoryIcon = () => {
    switch (transaction.categoryIcon) {
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
      case 'Briefcase':
        return <Briefcase className="h-4 w-4" />;
      case 'Video':
        return <Video className="h-4 w-4" />;
      case 'Laptop':
        return <Laptop className="h-4 w-4" />;
      case 'TrendingUp':
        return <TrendingUp className="h-4 w-4" />;
      case 'ArrowRightLeft':
        return <ArrowRightLeft className="h-4 w-4" />;
      default:
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const isIncome = transaction.type === 'INCOME';
  const isTransfer = transaction.type === 'TRANSFER';
  const isExpense = transaction.type === 'EXPENSE';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between p-3 sm:p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer',
        compact ? 'py-2 px-2.5' : ''
      )}
    >
      <div className="flex items-center space-x-3 min-w-0 pr-2">
        <div
          className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs"
          style={{ backgroundColor: transaction.categoryColor || '#64748b' }}
        >
          {getCategoryIcon()}
        </div>
        <div className="min-w-0 truncate">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {transaction.merchant}
            </p>
            {transaction.currency !== 'VND' && (
              <CurrencyBadge currency={transaction.currency} />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {transaction.categoryName} ·{' '}
            {isTransfer && transaction.toAccountName
              ? `${transaction.accountName} → ${transaction.toAccountName}`
              : transaction.accountName}
            {transaction.incomeSourceName ? ` · ${transaction.incomeSourceName}` : ''}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="flex items-center justify-end space-x-1">
          {isIncome ? (
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : isExpense ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
          ) : (
            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />
          )}
          <span
            className={cn(
              'text-sm sm:text-base font-semibold',
              isIncome
                ? 'text-emerald-600 dark:text-emerald-400'
                : isTransfer
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-900 dark:text-slate-100'
            )}
          >
            {isIncome ? '+' : isExpense ? '-' : ''}
            {formatMoney(transaction.amount, transaction.currency)}
          </span>
        </div>
        <div className="flex items-center justify-end space-x-1.5 mt-0.5">
          {transaction.currency !== 'VND' && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {formatConverted(transaction.baseAmountVND)} ·
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            {formatDateVN(transaction.occurredAt)}
          </span>
        </div>
      </div>
    </div>
  );
};
